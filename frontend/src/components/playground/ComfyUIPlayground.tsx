import React, { useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface WorkflowItem {
  id: string;
  name: string;
}

interface PlaygroundObject {
  workflow_name: string;
  inputs: Record<string, any>;
  nodes: Record<string, any>;
  output_type: string;
  is_valid: boolean;
  invalid_reason?: string;
  image_node_map: Record<string, string>;
  id: string;
  needsImage?: boolean;
  hasUserSelectedImage?: boolean;
}

const ComfyUIPlayground = () => {
  const { backend } = useSettingsStore();
  const baseUrl = backend?.apiUrl || 'http://127.0.0.1:8000';

  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [activeWorkflowData, setActiveWorkflowData] = useState<PlaygroundObject | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  const refreshGallery = async () => {
    setIsLoadingImages(true);
    try {
      const res = await fetch(`${baseUrl}/gallery`);
      if (res.ok) {
        const data = await res.json();
        setGeneratedImages(data);
      }
    } catch (error) {
      console.error("Error refreshing gallery:", error);
    } finally {
      setIsLoadingImages(false);
    }
  };

  const handleGenerate = async () => {
    if (!activeWorkflowData || !activeWorkflowData.is_valid) return;

    setIsGenerating(true);

    let uploadedName = selectedGalleryImage;

    if (activeWorkflowData.needsImage && activeWorkflowData.hasUserSelectedImage) {
      const uploadRes = await fetch(`${baseUrl}/comfyui/upload/image?filename=${selectedGalleryImage}`, {
        method: 'POST',
      });

      if (uploadRes.ok) {
        const data = await uploadRes.json();
        uploadedName = data.name;
        console.log(`[Upload] Selected: ${selectedGalleryImage} | Uploaded as: ${uploadedName}`);

        Object.keys(activeWorkflowData.inputs).forEach(key => {
          const field = activeWorkflowData.inputs[key];
          if (field.type?.toLowerCase() === 'image') {
            if (key.toLowerCase().includes('image')) {
              if ("value" in field) {
                activeWorkflowData.inputs[key].value = uploadedName;
              } else {
                activeWorkflowData.inputs[key] = uploadedName;
              }
            }
          }
        });
      } else {
        console.error(`[Upload] Failed to upload ${selectedGalleryImage}. Response:`, await uploadRes.json());
      }
    }

    const finalInputs: Record<string, any> = {};
    Object.keys(activeWorkflowData.inputs).forEach(key => {
      const field = activeWorkflowData.inputs[key];
      if (field.type?.toLowerCase() === 'image') {
        finalInputs[key] = field.value;
      } else {
        finalInputs[key] = inputValues[key] ?? field.value;
      }
    });

    console.log("[Generate] Sending final inputs:", JSON.stringify(finalInputs, null, 2));

    if (activeWorkflowData.needsImage && !uploadedName) {
      console.warn("Generation skipped because the required image was not successfully uploaded.");
      setIsGenerating(false);
      return;
    }

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
      setResultImage(URL.createObjectURL(blob));
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-8">
      {/* Workflow Selection */}
      {workflows.length === 0 && !isLoadingList ? (
        <div>...</div>
      ) : (
        <div className="flex gap-8">
          <section className="flex-1">
            {/* Inputs Section with File Picker */}
            <div className="flex flex-col gap-4">
              {activeWorkflowData && Object.entries(activeWorkflowData.inputs).map(([role, field]) => (
                <div key={role} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-gray-500">{role}</label>
                  {field.type === 'image' ? (
                    <input
                      type="file"
                      accept="image/*"
                      className="p-2 border rounded bg-white"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedGalleryImage(file.name);
                          setActiveWorkflowData(prev => prev ? ({
                            ...prev,
                            hasUserSelectedImage: true
                          }) : null);
                        }
                      }}
                    />
                  ) : (
                    <input
                      type="number"
                      className="p-2 border rounded bg-white"
                      value={inputValues[role]}
                      onChange={(e) => setInputValues(prev => ({ ...prev, [role]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !activeWorkflowData?.is_valid}
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
          </section>

          <section className="w-80 border p-4 rounded-xl bg-gray-100 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Generated Gallery</h3>
              <button
                onClick={refreshGallery}
                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors"
              >
                Refresh
              </button>
            </div>
            {isLoadingImages ? (
              <p className="text-sm text-gray-500 italic">Loading images...</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[70vh]">
                {generatedImages.map((img, idx) => {
                  const isSelected = selectedGalleryImage === img;
                  return (
                    <div
                      key={idx}
                      className={`relative group cursor-pointer ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={() => {
                        if (selectedGalleryImage === img) {
                          setSelectedGalleryImage(null);
                        } else {
                          setSelectedGalleryImage(img);
                        }
                      }}
                    >
                      <img src={img} alt={`Generated ${idx}`} className="w-full h-auto rounded" />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default ComfyUIPlayground;
