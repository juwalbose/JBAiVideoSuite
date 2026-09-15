import React, { useState, useRef, useEffect } from 'react';
import WorkflowInputs from './WorkflowInputs';
import GenerationResult from './GenerationResult';
import { useSettingsStore } from '../../store/settingsStore';

interface InputField {
  type: 'string' | 'int' | 'float' | 'image' | 'audio';
  value: string | number;
}

interface PlaygroundObject {
  workflow_name: string;
  inputs: Record<string, InputField>;
  nodes: Record<string, any>;
  output_type: string;
  is_valid: boolean;
  invalid_reason?: string;
  image_node_map: Record<string, string>;
  audio_node_map?: Record<string, string>;
}

interface WorkflowInputManagerProps {
  activeWorkflowData: PlaygroundObject | null;
  baseUrl: string;
  workflowId: string | null;
  resultImage: string | null;
  queueCount: number;
  onResultImage: (url: string) => void;
  onQueueChange: (count: number) => void;
}

const WorkflowInputManager = ({
  activeWorkflowData,
  baseUrl,
  workflowId,
  resultImage,
  queueCount,
  onResultImage,
  onQueueChange,
}: WorkflowInputManagerProps) => {
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [resultType, setResultType] = useState<'image' | 'video'>('image');
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);
  const { comfyui } = useSettingsStore();
  const pollInterval = comfyui.pollInterval || 4000;

  const baseUrlRef = useRef(baseUrl);
  const pollIntervalRef = useRef(pollInterval);
  const onResultImageRef = useRef(onResultImage);
  const onQueueChangeRef = useRef(onQueueChange);
  baseUrlRef.current = baseUrl;
  pollIntervalRef.current = pollInterval;
  onResultImageRef.current = onResultImage;
  onQueueChangeRef.current = onQueueChange;

  React.useEffect(() => {
    if (activeWorkflowData && activeWorkflowData.nodes) {
      const newInputs: Record<string, any> = {};
      Object.entries(activeWorkflowData.inputs).forEach(([id, field]) => {
        newInputs[id] = {
          type: field.type,
          value: field.value ?? ""
        };
      });
      setInputValues(newInputs);
      setResultType(activeWorkflowData.output_type === 'video' ? 'video' : 'image');
    }
  }, [activeWorkflowData]);

  const runPollCycle = async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const activeRes = await fetch(`${baseUrlRef.current}/playground/active`);
      if (!activeRes.ok) {
        isPollingRef.current = false;
        return;
      }
      const activeData = await activeRes.json();
      const tasks: string[] = activeData.tasks || [];
      onQueueChangeRef.current(tasks.length);

      if (tasks.length === 0) {
        isPollingRef.current = false;
        return;
      }

      for (const taskId of tasks) {
        try {
          const res = await fetch(`${baseUrlRef.current}/playground/status/${taskId}`);
          if (res.status === 404) continue;

          const contentType = res.headers.get('content-type') || '';
          if (contentType.startsWith('image/') || contentType.startsWith('video/')) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            onResultImageRef.current(url);
            fetch(`${baseUrlRef.current}/playground/status/${taskId}`, { method: 'DELETE' }).catch(() => {});
          }
        } catch (err) {
          console.error(`[Gen] Poll error for task ${taskId}:`, err);
        }
      }
    } catch (err) {
      console.error('[Gen] Poll cycle error:', err);
    }

    isPollingRef.current = false;
    pollTimerRef.current = setTimeout(runPollCycle, pollIntervalRef.current);
  };

  const startPolling = () => {
    if (pollTimerRef.current === null) {
      pollTimerRef.current = setTimeout(runPollCycle, pollIntervalRef.current);
    }
  };

  useEffect(() => {
    startPolling();
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const handleGenerate = async () => {
    if (!activeWorkflowData || !activeWorkflowData.is_valid) return;

    const fileRoles = Object.entries(inputValues).filter(([_, value]) =>
      value?.type === 'image' || value?.type === 'audio'
    );

    const sortedFileRoles = [...fileRoles].sort((a, b) => {
      const titleA = activeWorkflowData.nodes[a[0]]?._meta?.title || "";
      const titleB = activeWorkflowData.nodes[b[0]]?._meta?.title || "";
      return (parseInt(titleA.toLowerCase().replace(/\D/g, '')) || 0) -
             (parseInt(titleB.toLowerCase().replace(/\D/g, '')) || 0);
    });

    if (fileRoles.length > 0) {
      for (const [role, _] of sortedFileRoles) {
        if (!inputValues[role]) {
          const label = inputValues[role]?.type === 'audio' ? 'audio' : 'image';
          alert(`Please select a ${label} for the "${role}" input.`);
          return;
        }
      }
    }

    const finalInputs: Record<string, any> = {};

    for (const [role, data] of Object.entries(inputValues)) {
      if (data?.type === 'image' || data?.type === 'audio') {
        const nodeMap = data.type === 'image'
          ? activeWorkflowData.image_node_map
          : activeWorkflowData.audio_node_map;
        const nodeId = nodeMap?.[role] || role;

        if (data.value instanceof File) {
          try {
            const formData = new FormData();
            formData.append('file', data.value);

            const res = await fetch(`${baseUrl}/comfyui/upload`, {
              method: 'POST',
              body: formData,
            });

            if (!res.ok) throw new Error(`Upload failed for Node ${nodeId}`);

            const resultData = await res.json();
            setInputValues(prev => ({ ...prev, [role]: { type: data.type, value: resultData.name } }));
            finalInputs[role] = [nodeId, resultData.name];
          } catch (err) {
            const fallbackValue = data.value instanceof File ? data.value.name : data.value;
            finalInputs[role] = [nodeId, fallbackValue];
          }
        } else {
          finalInputs[role] = [nodeId, data.value];
        }
      } else {
        finalInputs[role] = data.value;
      }
    }

    const payload = {
      workflow_id: workflowId,
      inputs: finalInputs
    };

    try {
      const response = await fetch(`${baseUrl}/playground/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`[Gen] Queued: task_id=${data.task_id}`);
      onQueueChangeRef.current(queueCount + 1);
    } catch (error) {
      console.error("[Gen] Failed to queue generation:", error);
    }
  };

  if (!activeWorkflowData) {
    return <p className="text-gray-500 italic">Select a workflow to begin.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Current Workflow: <span className="font-bold">{activeWorkflowData.workflow_name}</span>
          {!activeWorkflowData.is_valid && (
            <span className="ml-2 text-red-500">
              (Invalid: {activeWorkflowData.invalid_reason})
            </span>
          )}
        </p>
      </div>

      <GenerationResult
        isGenerating={queueCount > 0}
        queueCount={queueCount}
        resultImage={resultImage}
        resultType={resultType}
        onGenerate={handleGenerate}
        isValid={activeWorkflowData.is_valid}
      />

      <WorkflowInputs
        inputs={inputValues}
        values={inputValues}
        nodes={activeWorkflowData.nodes}
        baseUrl={baseUrl}
        onChange={(nodeId, value) => setInputValues(prev => ({ ...prev, [nodeId]: { type: prev[nodeId]?.type ?? 'string', value } }))}
      />
    </div>
  );
};

export default WorkflowInputManager;
