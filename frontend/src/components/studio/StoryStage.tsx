import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';

const StoryStage = () => {
  const { currentProject, updateStory, updateProject, setProject } = useProjectStore();
  const [rawInput, setRawInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize project if none exists
  useEffect(() => {
    if (!currentProject) {
      setProject({
        id: 'new-project',
        name: 'My New Story',
        description: '',
        beats: [],
        assets: [],
        story: { narrativeArc: '', rawInput: '' }
      });
    }
  }, [currentProject, setProject]);

  // Sync rawInput with the story's rawInput when currentProject changes or is first loaded
  useEffect(() => {
    if (currentProject?.story) {
      setRawInput(currentProject.story.rawInput || '');
    }
  }, [currentProject?.story]);

  const handleGenerateStory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/projects/${currentProject.id}/generate-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
      });

      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      console.log("LLM Response received:", data);
      await updateStory(data.narrative_arc, rawInput);
    } catch (error) {
      console.error("Error generating story:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 p-4">
      {currentProject && (
        <>
          <section className="space-y-2 border-b pb-6">
            <h3 className="text-lg font-semibold mb-2 text-blue-900">Project Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  className="w-full p-2 border rounded bg-white text-black"
                  value={currentProject.name}
                  onChange={(e) => updateProject(e.target.value, currentProject.description)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  className="w-full p-2 border rounded bg-white text-black"
                  value={currentProject.description || ''}
                  onChange={(e) => updateProject(currentProject.name, e.target.value)}
                />
              </div>
            </div>
            <button 
              onClick={() => updateProject(currentProject.name, currentProject.description)}
              className="mt-2 px-4 py-1 bg-gray-800 text-white rounded text-sm hover:bg-black"
            >
              Save Details
            </button>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-blue-900">1. Raw Idea</h3>
              <textarea
                className="w-full p-4 border rounded bg-white text-black"
                rows={4}
                placeholder="Enter your raw story idea here..."
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
              />
            </div>

            {currentProject?.story && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <h3 className="text-lg font-semibold mb-2 text-blue-900">2. Narrative Arc</h3>
                <div className="p-4 border rounded bg-blue-50 text-gray-800 whitespace-pre-wrap min-h-[100px] shadow-inner">
                  {currentProject.story.narrativeArc || 'Narrative arc will appear here...'}
                </div>
              </div>
            )}
          </section>

          <div className="flex justify-center mt-8 pt-4 border-t">
            <button
              onClick={handleGenerateStory}
              disabled={isLoading || !rawInput}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Generating...' : currentProject.story?.narrativeArc ? 'Regenerate Narrative Arc' : 'Generate Narrative Arc'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default StoryStage;
