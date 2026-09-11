import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import Gallery from '../Gallery';
import WorkflowSelector from './WorkflowSelector';
import WorkflowInputManager from './WorkflowInputManager';

interface PlaygroundObject {
  workflow_name: string;
  inputs: Record<string, any>;
  output_type: string;
  is_valid: boolean;
  invalid_reason?: string;
  id: string;
}

interface WorkflowItem {
  id: string;
  name: string;
}

const ComfyUIPlayground = () => {
  const { backendSettings } = useSettingsStore();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  
  const baseUrl = backendSettings?.apiUrl || 'http://localhost:8000';

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [activeWorkflowData, setActiveWorkflowData] = useState<PlaygroundObject | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingParse, setIsLoadingParse] = useState(false);

  // Effect 1: Fetch all workflows from the folder on mount
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const response = await fetch(`${baseUrl}/playground/list`);
        if (response.ok) {
          const data: WorkflowItem[] = await response.json();
          setWorkflows(data);

          // Auto-select the first one if it exists
          if (data.length > 0 && !selectedWorkflowId) {
            setSelectedWorkflowId(data[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching workflow list:", error);
      } finally {
        setIsLoadingList(false);
      }
    };

    fetchWorkflows();
  }, [baseUrl]);

  // Effect 2: Fetch parsed data whenever selectedWorkflowId changes
  useEffect(() => {
    if (selectedWorkflowId) {
      setActiveWorkflowData(null);
      setIsLoadingParse(true);
      const fetchParsedData = async () => {
        try {
          const response = await fetch(`${baseUrl}/playground/parse/${selectedWorkflowId}`);
          if (response.ok) {
            const data: PlaygroundObject = await response.json();
            setActiveWorkflowData(data);
          } else {
            console.error("Failed to parse workflow");
          }
        } catch (error) {
          console.error("Error parsing workflow:", error);
        } finally {
          setIsLoadingParse(false);
        }
      };

      fetchParsedData();
    }
  }, [selectedWorkflowId, baseUrl]);

  if (workflows.length === 0 && !isLoadingList) {
    return (
      <div className="flex flex-col gap-8 p-4">
        <h3 className="text-lg font-bold">Workflow Selection</h3>
        <p className="text-gray-500 italic">No workflows available. Add some in the Settings tab!</p>
        <section className="border p-6 rounded-xl bg-gray-50">
          <p className="text-gray-400 italic">Select a workflow to see its inputs.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-4 h-[calc(100vh-2rem)]">
      <div className="flex flex-row gap-8 w-full h-full">
        {/* Left Column: Gallery - Removed overflow-y-auto to let Gallery handle its own scroll */}
        <div className="w-1/3">
          <Gallery />
        </div>

        {/* Right Column: Workflow Selection + Preview */}
        <div className="w-2/3 border p-6 rounded-xl bg-gray-50 shadow-sm flex flex-col gap-8 overflow-y-auto">
          <WorkflowSelector 
            workflows={workflows} 
            selectedId={selectedWorkflowId} 
            onSelect={setSelectedWorkflowId} 
          />

          <section>
            <h3 className="text-lg font-bold mb-4">Preview</h3>
            {isLoadingParse ? (
              <p className="text-gray-500 italic">Parsing workflow...</p>
            ) : activeWorkflowData ? (
              <WorkflowInputManager 
                activeWorkflowData={activeWorkflowData} 
                baseUrl={baseUrl}
                workflowId={selectedWorkflowId}
              />
            ) : (
              !isLoadingParse && <p className="text-gray-500">Select a workflow to begin.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ComfyUIPlayground;
