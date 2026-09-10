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
  id: string; 
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
    if (activeWorkflowData && activeWorkflowData.nodes) {
      const newInputs: Record<string, any> = {};
      
      // 1. Identify all nodes that have an image role from the nodes object directly
      const imageNodeIds = Object.keys(activeWorkflowData.inputs).filter(id => 
        activeWorkflowData.inputs[id]?.type === 'image'
      );

      if (imageNodeIds.length === 1) {
        // Single Image Workflow: Use the standard "image" key
        const id = imageNodeIds[0];
        const field = activeWorkflowData.inputs[id];
        newInputs["image"] = {
          type: 'image',
          value: field?.value ?? ""
        };
      } else if (imageNodeIds.length > 1) {
        // Multi-Image Workflow: Use the actual Node ID as the key for a 1:1 relation
        const sortedIds = [...imageNodeIds].sort((a, b) => {
          const nodeA = activeWorkflowData.nodes[a];
          const nodeB = activeWorkflowData.nodes[b];
          const titleA = nodeA?._meta?.title || "";
          const titleB = nodeB?._meta?.title || "";
          const numA = parseInt(titleA.toLowerCase().replace(/\D/g, '')) || 0;
          const numB = parseInt(titleB.toLowerCase().replace(/\D/g, '')) || 0;
          return numA - numB;
        });

        sortedIds.forEach((id) => {
          const field = activeWorkflowData.inputs[id];
          newInputs[id] = { // Changed from `image${index + 1}` to `id`
            type: 'image',
            value: field?.value ?? ""
          };
        });
      }

      // 2. Process all other inputs (strings, ints) using their original roles/IDs
      Object.entries(activeWorkflowData.inputs).forEach(([role, field]) => {
        if (field.type !== 'image') {
          newInputs[role] = {
            type: field.type,
            value: field.value
          };
        }
      });

      setInputValues(newInputs);
    }
  }, [activeWorkflowData]);

  const handleGenerate = async () => {
    if (!activeWorkflowData || !activeWorkflowData.is_valid) return;

    console.log("[Gen] Starting generation process...");

    // Identify image roles (using the keys we established in useEffect)
    const imageRoles = Object.entries(inputValues).filter(([_, value]) => 
      value?.type === 'image'
    );
    
    console.log(`[Gen] Image roles identified: ${JSON.stringify(imageRoles)}`);

    let sortedImageRoles = [...imageRoles];

    if (imageRoles.length > 1) {
      sortedImageRoles = imageRoles.sort((a, b) => {
        const titleA = activeWorkflowData.nodes[a[0]]?._meta?.title || "";
        const titleB = activeWorkflowData.nodes[b[0]]?._meta?.title || "";
        const numA = parseInt(titleA.toLowerCase().replace(/\D/g, '')) || 0;
        const numB = parseInt(titleB.toLowerCase().replace(/\D/g, '')) || 0;
        return numA - numB;
      });
    }

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
        if (data.value instanceof File) {
          try {
            console.log(`[Gen] Uploading file for role "${role}":`, data.value.name);
            const formData = new FormData();
            formData.append('file', data.value);

            const res = await fetch(`${baseUrl}/comfyui/upload`, {
              method: 'POST',
              body: formData,
            });

            if (!res.ok) throw new Error(`Upload failed for ${role}`);
            
            const resultData = await res.json();
            console.log(`[Gen] Upload success for "${role}". Received name from ComfyUI:`, resultData.name);
            setInputValues(prev => ({ ...prev, [role]: { type: 'image', value: resultData.name } }));

            finalInputs[role] = resultData.name; 
          } catch (err) {
            console.error(`[Gen] Error uploading image for "${role}":`, err);
            const fallbackValue = data.value instanceof File ? data.value.name : data.value;
            finalInputs[role] = fallbackValue;
          }
        } else {
          // If it's an image but not a File (already uploaded or default), use the value
          finalInputs[role] = data.value;
        }
      } else {
        // For non-image types, just take the value
        finalInputs[role] = data.value;
      }
    }

    console.log("[Gen] Final inputs payload constructed:", finalInputs);

    try {
      console.log("[Gen] Sending generation request to server...");
      const response = await fetch(`${baseUrl}/playground/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workflow_id: workflowId,
          inputs: finalInputs 
        }),
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
        onChange={(role, value) => setInputValues(prev => ({ ...prev, [role]: { type: prev[role]?.type ?? 'string', value } }))}
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