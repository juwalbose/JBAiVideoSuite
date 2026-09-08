import React, { useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const ComfyUIPlayground = () => {
  const { workflows, comfyui, setComfyUI } = useSettingsStore();
  const [selectedWorkflow, setSelectedWorkflow] = useState(workflows[0]?.id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState(null);

  const handleGenerate = async () => {
    if (!selectedWorkflow) return;
    setIsGenerating(true);
    
    // Placeholder for actual generation logic
    // In the future, this will call a backend route that sends the workflow JSON to ComfyUI
    setTimeout(() => {
      setIsGenerating(false);
      setResultImage('https://via.placeholder.com/512x512?text=Generated+Image');
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-8 p-4">
      <section>
        <h3 className="text-lg font-bold mb-4">Workflow Selection</h3>
        <div className="flex flex-wrap gap-2">
          {workflows.length > 0 ? (
            workflows.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWorkflow(w.id)}
                className={`px-4 py-2 rounded border ${selectedWorkflow === w.id ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'}`}
              >
                {w.name}
              </button>
            ))
          ) : (
            <p className="text-gray-500 italic">No workflows available. Add some in the Settings tab!</p>
          )}
        </div>
      </section>

      <section className="border p-6 rounded-xl bg-gray-50">
        <h3 className="text-lg font-bold mb-4">Preview</h3>
        {selectedWorkflow ? (
          <>
            <div className="mb-4">
              <p className="text-sm text-gray-600">Current Workflow: <span className="font-bold">{workflows.find(w => w.id === selectedWorkflow)?.name}</span></p>
            </div>
            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
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
          <p className="text-gray-500">Select a workflow to begin.</p>
        )}
      </section>
    </div>
  );
};

export default ComfyUIPlayground;
