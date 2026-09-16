import React, { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';

const StoryStage = ({ selectedEpisode, onEpisodeCountChange, onNavigateToScript }: { selectedEpisode: number; onEpisodeCountChange?: (count: number) => void; onNavigateToScript?: () => void }) => {
  const { currentProject, updateProject, updateStory, storyDraft, setStoryDraft } = useProjectStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [episodeCount, setEpisodeCount] = useState(1);
  const [duration, setDuration] = useState(120);
  const [name, setName] = useState('');
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Draft lives in the store so it survives tab switches
  const rawInput = storyDraft?.rawInput ?? currentProject?.story?.rawInput ?? '';
  const narrativeArc = storyDraft?.narrativeArc ?? currentProject?.story?.narrativeArc ?? '';

  const updateDraft = (patch: Partial<{ rawInput: string; narrativeArc: string }>) => {
    setStoryDraft({ rawInput, narrativeArc, ...patch });
  };

  // Sync local state with project data when currentProject changes
  useEffect(() => {
    if (currentProject) {
      setDuration(currentProject.duration || 120);
      setEpisodeCount(currentProject.episodeCount || 1);
      setName(currentProject.name);
      // Reset draft to saved values when project changes
      setStoryDraft({
        rawInput: currentProject.story?.rawInput || '',
        narrativeArc: currentProject.story?.narrativeArc || '',
      });
    }
  }, [currentProject?.id]);

  // Debounced name save: fires 800ms after the user stops typing
  useEffect(() => {
    if (!currentProject || name === currentProject.name) return;
    nameDebounceRef.current = setTimeout(() => {
      updateProject(name).catch(() => {});
    }, 800);
    return () => clearTimeout(nameDebounceRef.current);
  }, [name]);

  const handleGenerateStory = async () => {
    if (!currentProject) return;
    setIsLoading(true);
    setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/generate-story?episode=${selectedEpisode}`, {
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
      updateDraft({ narrativeArc: data.narrative_arc });
    } catch (error) {
      console.error("Error generating story:", error);
      setError('Failed to generate story. Check backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentProject) return;
    setIsSaving(true);
    setError('');
    try {
      await updateProject(currentProject.name, duration, currentProject.type === 'episodic' ? episodeCount : undefined);
      await updateStory(narrativeArc, rawInput, selectedEpisode);
      // Clear draft after successful save — store now matches saved state
      setStoryDraft(null);
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
            <h3 className="text-lg font-semibold mb-2 text-foreground">Project Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground">Name</label>
                <input
                  className="w-full p-2 border border-border rounded bg-card text-foreground"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">1. Raw Idea</h3>
              <textarea
                className="w-full p-4 border border-border rounded bg-card text-foreground resize-y"
                rows={6}
                placeholder="Enter your raw story idea here..."
                value={rawInput}
                onChange={(e) => updateDraft({ rawInput: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-foreground">Duration</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDuration(Math.max(15, duration - 15))}
                  className="px-2 py-1 border border-border rounded bg-muted hover:bg-muted/80 text-sm font-bold"
                >
                  −
                </button>
                <span className="px-3 py-1 border border-border rounded bg-card text-sm font-mono">
                  {Math.floor(duration / 60)}m {duration % 60}s
                </span>
                <button
                  onClick={() => setDuration(duration + 15)}
                  className="px-2 py-1 border border-border rounded bg-muted hover:bg-muted/80 text-sm font-bold"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-muted-foreground">
                {currentProject.type === 'episodic' ? 'per episode' : 'total video'}
              </span>
            </div>

            {currentProject?.story && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <h3 className="text-lg font-semibold mb-2 text-foreground">2. Narrative Arc</h3>
                <textarea
                  className="w-full p-4 border border-border rounded bg-accent-soft text-foreground whitespace-pre-wrap min-h-[100px] shadow-inner resize-y"
                  rows={10}
                  value={narrativeArc}
                  onChange={(e) => updateDraft({ narrativeArc: e.target.value })}
                  placeholder="Narrative arc will appear here..."
                />
              </div>
            )}
          </section>

          {currentProject.type === 'episodic' && (
            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Episodes</h3>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-muted-foreground">Number of Episodes:</label>
                <input
                  type="number"
                  min={1}
                  className="w-24 p-2 border border-border rounded bg-card text-foreground"
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
            <div className="p-4 border border-destructive/40 bg-destructive/10 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-center gap-4 mt-8 pt-4 border-t border-border">
            <button
              onClick={handleGenerateStory}
              disabled={isLoading || !rawInput}
              className="px-6 py-2 bg-accent text-accent-foreground rounded hover:bg-accent/80 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Generating...' : narrativeArc ? 'Regenerate Arc' : 'Generate Narrative Arc'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-muted text-foreground rounded hover:bg-muted/80 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onNavigateToScript}
              disabled={!narrativeArc}
              className="px-6 py-2 bg-success text-white rounded hover:bg-success/80 disabled:opacity-50 transition-colors"
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
