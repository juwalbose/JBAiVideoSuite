import React, { useState } from 'react';
import WorkflowInputs from './WorkflowInputs';
import GenerationResult from './GenerationResult';

interface InputField {
  type: 'string' | 'int' | 'image';
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
}

interface WorkflowInputManagerProps {
  activeWorkflowData: PlaygroundObject | null;
  baseUrl: string;
  workflowId: string | null;
}

const WorkflowInputManager = ({ activeWorkflowData, baseUrl, workflowId }: WorkflowInputManagerProps) => {
  const [imagePaths, setImagePaths] = useState<Record<string, string>>({});
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);

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
    }
  }, [activeWorkflowData]);

  const handleGenerate = async () => {
    if (!activeWorkflowData || !activeWorkflowData.is_valid) return;

    console.log("[Gen] Starting generation process...");

    const imageRoles = Object.entries(inputValues).filter(([_, value]) => 
      value?.type === 'image'
    );
    
    const sortedImageRoles = [...imageRoles].sort((a, b) => {
      const titleA = activeWorkflowData.nodes[a[0]]?._meta?.title || "";
      const titleB = activeWorkflowData.nodes[b[0]]?._meta?.title || "";
      return (parseInt(titleA.toLowerCase().replace(/\D/g, '')) || 0) - 
             (parseInt(titleB.toLowerCase().replace(/\D/g, '')) || 0);
    });

    if (imageRoles.length > 0) {
      for (const [role, _] of sortedImageRoles) {
        if (!inputValues[role]) {
          console.warn(`[Gen] Validation: Missing value for role "${role}"`);
          alert(`Please select an image for the "${role}" input.`);
          return;
        }
      }
    }

    setIsGenerating(true);
    const finalInputs: Record<string, any> = {};
    
    console.log("[Gen] Processing inputs and uploading images...");

    for (const [role, data] of Object.entries(inputValues)) {
      if (data?.type === 'image') {
        const nodeId = activeWorkflowData.image_node_map[role] || role;

        if (data.value instanceof File) {
          try {
            console.log(`[Gen] Uploading file for Node ${nodeId}:`, data.value.name);
            const formData = new FormData();
            formData.append('file', data.value);

            const res = await fetch(`${baseUrl}/comfyui/upload`, {
              method: 'POST',
              body: formData,
            });

            if (!res.ok) throw new Error(`Upload failed for Node ${nodeId}`);
            
            const resultData = await res.json();
            console.log(`[Gen] Upload success for Node ${nodeId}. Received name from ComfyUI:`, resultData.name);
            setInputValues(prev => ({ ...prev, [role]: { type: 'image', value: resultData.name } }));

            finalInputs[role] = [nodeId, resultData.name]; 
          } catch (err) {
            console.error(`[Gen] Error uploading image for Node ${nodeId}:`, err);
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

    console.log("[Gen] Final JSON payload:", JSON.stringify(payload, null, 2));

    try {
      console.log("[Gen] Sending generation request to server...");
      const response = await fetch(`${baseUrl}/playground/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }

      console.log("[Gen] Generation request successful.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setResultImage(url);
    } catch (error) {
      console.error("[Gen] Final generation failed:", error);
    } finally {
      setIsGenerating(false);
      console.log("[Gen] Generation process complete.");
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

      <WorkflowInputs 
        inputs={inputValues}
        values={inputValues}
        nodes={activeWorkflowData.nodes}
        baseUrl={baseUrl}
        onChange={(nodeId, value) => setInputValues(prev => ({ ...prev, [nodeId]: { type: prev[nodeId]?.type ?? 'string', value } }))}
      />

      <GenerationResult 
        isGenerating={isGenerating}
        resultImage={resultImage}
        onGenerate={handleGenerate}
        isValid={activeWorkflowData.is_valid}
      />
    </div>
  );
};

export default WorkflowInputManager;