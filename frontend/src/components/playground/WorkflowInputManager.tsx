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

    // Identify image roles
    const imageRoles = Object.entries(activeWorkflowData.inputs).filter(([_, field]) => field.type === 'image');
    
    // Basic check: If it's an image workflow, ensure all images are selected
    if (imageRoles.length > 0) {
      for (const [role, _] of imageRoles) {
        if (!inputValues[role]) {
          alert(`Please select an image for the "${role}" input.`);
          return; // Exit early if any image is missing
        }
      }

      const filenames = imageRoles.map(([role, _]) => `[${role}]: ${inputValues[role] instanceof File ? inputValues[role].name : inputValues[role]}`).join(', ');
      console.log(`Image Input Workflow detected!\nFiles: ${filenames}`);
    }

    setIsGenerating(true);
    
    const finalInputs: Record<string, any> = {};
    for (const key of Object.keys(activeWorkflowData.inputs)) {
      const field = activeWorkflowData.inputs[key];
      if (field.type === 'image') {
        // If it's an image role and we have a File object, upload it first
        if (inputValues[key] instanceof File) {
          console.log(`Starting upload for ${key}...`);
          try {
            const formData = new FormData();
            formData.append('file', inputValues[key]);

            const res = await fetch(`${baseUrl}/comfyui/upload`, {
              method: 'POST',
              body: formData,
            });

            if (!res.ok) throw new Error(`Upload failed for ${key}`);
            
            const data = await res.json();
            console.log(`Upload response for ${key}:`, data);
            // Update the value in our local state to the name returned by ComfyUI
            setInputValues(prev => ({ ...prev, [key]: data.name }));
            // Also update finalInputs with the new name
            finalInputs[key] = data.name;
          } catch (err) {
            console.error(`Error uploading image for ${key}:`, err);
            // If it failed to upload, use the filename of the File object as a fallback
            finalInputs[key] = inputValues[key] instanceof File ? inputValues[key].name : inputValues[key];
          }
        } else {
          // Ensure we are passing a string (either the picked name or the default value)
          const val = inputValues[key] ?? field.value;
          finalInputs[key] = typeof val === 'object' ? (val as any).name : val;
        }
      } else {
        // For non-image types, ensure we pass a string or number
        const val = inputValues[key] ?? field.value;
        finalInputs[key] = typeof val === 'object' ? (val as any).name : val;
      }
    }

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