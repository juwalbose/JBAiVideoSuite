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
  output_type: string;
  is_valid: boolean;
  invalid_reason?: string;
  id: string; // Added id to the object for easier access in handleGenerate
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

  // Initialize input values when activeWorkflowData changes
  React.useEffect(() => {
    if (activeWorkflowData) {
      const initialInputs: Record<string, any> = {};
      Object.entries(activeWorkflowData.inputs).forEach(([role, field]) => {
        initialInputs[role] = field.value;
      });
      setInputValues(initialInputs);
    }
  }, [activeWorkflowData]);

  const handleGenerate = async () => {
    if (!activeWorkflowData || !activeWorkflowData.is_valid) return;

    // Check if it's an image input workflow
    const imageRoles = Object.entries(activeWorkflowData.inputs).filter(([_, field]) => field.type === 'image');
    
    if (imageRoles.length > 0) {
      const filenames = imageRoles.map(([role, _]) => `[${role}]: ${inputValues[role] || "No file picked"}`).join(', ');
      alert(`Image Input Workflow detected!\nFiles: ${filenames}`);
    }

    setIsGenerating(true);
    
    const finalInputs: Record<string, any> = {};
    Object.keys(activeWorkflowData.inputs).forEach(key => {
      const field = activeWorkflowData.inputs[key];
      finalInputs[key] = inputValues[key] ?? field.value;
    });

    try {
      const response = await fetch(`${baseUrl}/playground/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workflow_id: workflowId,
          inputs: finalInputs 
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setResultImage(url);
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
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
        inputs={activeWorkflowData.inputs}
        values={inputValues}
        onChange={(role, value) => setInputValues(prev => ({ ...prev, [role]: value }))}
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
