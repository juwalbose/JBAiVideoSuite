import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface InputField {
  type: 'string' | 'int' | 'image';
  value: string | number;
}

interface PlaygroundObject {
  workflow_name: string;
  inputs: Record<string, InputField>;
  output_type: string;
  is_valid: boolean;
  invalid_reason?: string;
}

interface WorkflowItem {
  id: string;
  name: string;
}

const ComfyUIPlayground = () => {
  // Get workflows and the backend API URL from your store
  const { backendSettings } = useSettingsStore();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  
  // Use the apiUrl from settings (e.g., "http://127.0.0.1:8000")
  // We'll fallback to localhost:8000 if it's not loaded yet
  const baseUrl = backendSettings?.apiUrl || 'http://localhost:8000';

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [activeWorkflowData, setActiveWorkflowData] = useState<PlaygroundObject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true); // Loading the list of files
  const [isLoadingParse, setIsLoadingParse] = useState(false); // Loading the data for selected file

  // State to track selected image paths for each role (e.g., { "image": "assets/generated/my_image.png" })
  const [imagePaths, setImagePaths] = useState<Record<string, string>>({});

  // Local state to hold the current values of all inputs in the active workflow
  const [inputValues, setInputValues] = useState<Record<string, any>>({});

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
  }, [baseUrl]); // Re-run if baseUrl changes

  // Effect 2: Fetch parsed data whenever selectedWorkflowId changes
  useEffect(() => {
    if (selectedWorkflowId) {
      setActiveWorkflowData(null); // Clear previous data to trigger a new fetch
      setIsLoadingParse(true);
      const fetchParsedData = async () => {
        try {
          const response = await fetch(`${baseUrl}/playground/parse/${selectedWorkflowId}`);
          if (response.ok) {
            const data: PlaygroundObject = await response.json();
            setActiveWorkflowData(data);
            // Initialize inputValues with the parsed data
            const initialInputs: Record<string, any> = {};
            Object.entries(data.inputs).forEach(([role, field]) => {
              initialInputs[role] = field.value;
            });
            setInputValues(initialInputs);
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

  const handleGenerate = async () => {
    if (!activeWorkflowData || !activeWorkflowData.is_valid) return;
    setIsGenerating(true);
    
    const finalInputs: Record<string, any> = {};
    Object.keys(activeWorkflowData.inputs).forEach(key => {
      const field = activeWorkflowData.inputs[key];
      if (field.type === 'image') {
        finalInputs[key] = imagePaths[key] || field.value;
      } else {
        finalInputs[key] = inputValues[key] ?? field.value;
      }
    });

    try {
      const response = await fetch(`${baseUrl}/playground/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workflow_id: selectedWorkflowId, 
          inputs: finalInputs 
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
      }

      const blob = await response.blob();
      // Create a temporary URL for the image blob to display in the UI
      const url = URL.createObjectURL(blob);
      setResultImage(url);
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  // State 0: No Workflows at all
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
    <div className="flex flex-col gap-8 p-4">
      <section>
        <h3 className="text-lg font-bold mb-4">Workflow Selection</h3>
        <div className="flex flex-wrap gap-2">
          {workflows.map(w => (
            <button
              key={w.id}
              onClick={() => setSelectedWorkflowId(w.id)}
              className={`px-4 py-2 rounded border ${selectedWorkflowId === w.id ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'}`}
            >
              {w.name}
            </button>
          ))}
        </div>
      </section>

      <section className="border p-6 rounded-xl bg-gray-50">
        <h3 className="text-lg font-bold mb-4">Preview</h3>
        {isLoadingParse ? (
          <p className="text-gray-500 italic">Parsing workflow...</p>
        ) : activeWorkflowData ? (
          <>
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

            <div className="flex flex-col gap-4 mb-6">
              {Object.entries(activeWorkflowData.inputs).map(([role, field]) => {
                if (field.type === 'string') {
                  return (
                    <div key={role} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase text-gray-500">{role}</label>
                      <textarea 
                        className="p-2 border rounded bg-white"
                        rows={3}
                        value={inputValues[role]}
                        onChange={(e) => setInputValues(prev => ({ ...prev, [role]: e.target.value }))}
                      />
                    </div>
                  );
                } else if (field.type === 'image') {
                  return (
                    <div key={role} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase text-gray-500">{role}</label>
                      <input 
                        type="file" 
                        accept="image/*"
                        className="p-2 border rounded bg-white"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setImagePaths(prev => ({ ...prev, [role]: file.name }));
                          }
                        }}
                      />
                    </div>
                  );
                } else {
                  return (
                    <div key={role} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase text-gray-500">{role}</label>
                      <input 
                        type="number" 
                        className="p-2 border rounded bg-white"
                        value={inputValues[role]}
                        onChange={(e) => setInputValues(prev => ({ ...prev, [role]: parseInt(e.target.value) }))}
                      />
                    </div>
                  );
                }
              })}
            </div>

            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !activeWorkflowData.is_valid}
              className={`px-8 py-3 rounded-full font-bold text-white transition-all ${isGenerating ? 'bg-gray-400' : 'bg-blue-600 hover:scale-105 shadow-lg'}`}
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>

            <div className="mt-8 flex justify-center">
              {resultImage ? (
                <img src={resultImage} alt="Generated result" className="max-w-full h-auto rounded shadow-md border" />
              ) : (
                <div className="w-64 h-64 bg-gray-200 flex items-center justify-center rounded text-gray-400 italic">
                  Result will appear here
                </div>
              )}
            </div>
          </>
        ) : (
          !isLoadingParse && <p className="text-gray-500">Select a workflow to begin.</p>
        )}
      </section>
    </div>
  );
};

export default ComfyUIPlayground;