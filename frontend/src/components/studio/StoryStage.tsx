import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';

const StoryStage = ({ onEpisodeCountChange, onNavigateToScript }: { onEpisodeCountChange?: (count: number) => void; onNavigateToScript?: () => void }) => {
  const { currentProject, updateProject, updateStory } = useProjectStore();
  const [rawInput, setRawInput] = useState('');
  const [narrativeArc, setNarrativeArc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [episodeCount, setEpisodeCount] = useState(1);
  const [duration, setDuration] = useState(120);

  // Sync local state with project data when currentProject changes
  useEffect(() => {
    if (currentProject) {
      setRawInput(currentProject.story?.rawInput || '');
      setNarrativeArc(currentProject.story?.narrativeArc || '');
      setDuration(currentProject.duration || 120);
      setEpisodeCount(currentProject.episodeCount || 1);
    }
  }, [currentProject?.id]);

  const handleGenerateStory = async () => {
    setIsLoading(true);
    setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/generate-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
      });

      const data = await response.json();
      if (data.status === 'error') {
        setError(data.details);
        return;
      }
      console.log("LLM Response received:", data);
      setNarrativeArc(data.narrative_arc);
    } catch (error) {
      console.error("Error generating story:", error);
      setError('Failed to generate story. Check backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      await updateProject(currentProject.name, duration, currentProject.type === 'episodic' ? episodeCount : undefined);
      await updateStory(narrativeArc, rawInput);
    } catch (error) {
      console.error("Error saving:", error);
      setError('Failed to save. Check backend connection.');
    } finally {
      setIsSaving(false);
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
                  onChange={(e) => updateProject(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-blue-900">1. Raw Idea</h3>
              <textarea
                className="w-full p-4 border rounded bg-white text-black resize-y"
                rows={6}
                placeholder="Enter your raw story idea here..."
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-blue-900">Duration</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDuration(Math.max(15, duration - 15))}
                  className="px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100 text-sm font-bold"
                >
                  −
                </button>
                <span className="px-3 py-1 border rounded bg-white text-sm font-mono">
                  {Math.floor(duration / 60)}m {duration % 60}s
                </span>
                <button
                  onClick={() => setDuration(duration + 15)}
                  className="px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100 text-sm font-bold"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-gray-500">
                {currentProject.type === 'episodic' ? 'per episode' : 'total video'}
              </span>
            </div>

            {currentProject?.story && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <h3 className="text-lg font-semibold mb-2 text-blue-900">2. Narrative Arc</h3>
                <textarea
                  className="w-full p-4 border rounded bg-blue-50 text-gray-800 whitespace-pre-wrap min-h-[100px] shadow-inner resize-y"
                  rows={10}
                  value={narrativeArc}
                  onChange={(e) => setNarrativeArc(e.target.value)}
                  placeholder="Narrative arc will appear here..."
                />
              </div>
            )}
          </section>

          {currentProject.type === 'episodic' && (
            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-blue-900">Episodes</h3>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Number of Episodes:</label>
                <input
                  type="number"
                  min={1}
                  className="w-24 p-2 border rounded bg-white text-black"
                  value={episodeCount}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setEpisodeCount(val);
                    onEpisodeCountChange?.(val);
                  }}
                />
              </div>
            </section>
          )}

          {error && (
            <div className="p-4 border border-red-300 bg-red-50 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-center gap-4 mt-8 pt-4 border-t">
            <button
              onClick={handleGenerateStory}
              disabled={isLoading || !rawInput}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Generating...' : narrativeArc ? 'Regenerate Arc' : 'Generate Narrative Arc'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-gray-800 text-white rounded hover:bg-black disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onNavigateToScript}
              disabled={!narrativeArc}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default StoryStage;
