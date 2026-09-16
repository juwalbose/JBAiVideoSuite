import React, { useState, useEffect } from 'react';
import { useProjectStore, Script } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';
import ExtractComparisonModal from './ExtractComparisonModal';

const ScriptStage = ({ selectedEpisode, onNavigateToAssets }: { selectedEpisode: number; onNavigateToAssets?: () => void }) => {
  const { currentProject, scriptDraft, setScriptDraft } = useProjectStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasSavedAssets, setHasSavedAssets] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [comparisonData, setComparisonData] = useState<{ new: any[]; existing: any[] } | null>(null);
  const [existingAssetsList, setExistingAssetsList] = useState<{ id: string; name: string; type: string }[]>([]);

  // Draft lives in the store so it survives tab switches
  const script = scriptDraft?.script ?? currentProject?.script?.content ?? '';
  const cast = scriptDraft?.cast ?? '';
  const formattedCast = scriptDraft?.formattedCast ?? '';
  const refinedScript = scriptDraft?.refinedScript ?? '';

  const updateDraft = (patch: Partial<{ script: string; cast: string; formattedCast: string; refinedScript: string }>) => {
    setScriptDraft({ script, cast, formattedCast, refinedScript, ...patch });
  };

  // Sync local state with project data when currentProject or episode changes
  useEffect(() => {
    if (currentProject) {
      // Reset draft to saved values when project or episode changes
      setScriptDraft({
        script: currentProject.script?.content || '',
        cast: '',
        formattedCast: '',
        refinedScript: '',
      });
      // Fetch saved assets from DB and populate the cast box
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      fetch(`${baseUrl}/projects/${currentProject.id}/assets?episode=${selectedEpisode}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success' && data.assets) {
            const hasContent =
              data.assets.characters?.length ||
              data.assets.locations?.length ||
              data.assets.props?.length;
            if (hasContent) {
              const json = JSON.stringify(data.assets, null, 2);
              setScriptDraft(prev => prev ? { ...prev, cast: json, formattedCast: formatCast(json) } : { script: currentProject.script?.content || '', cast: json, formattedCast: formatCast(json), refinedScript: '' });
              setHasSavedAssets(true);
            }
          }
        })
        .catch(err => console.warn('Failed to load saved assets:', err));
    }
  }, [currentProject?.id, selectedEpisode]);

  const handleGenerateScript = async () => {
    if (!currentProject) return;
    setIsLoading(true);
    setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/generate-script?episode=${selectedEpisode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      console.log("Script response status:", data.status);
      console.log("Script response data:", data);
      if (data.status === 'error') {
        setError(data.details);
        return;
      }
      updateDraft({ script: data.script || '' });
    } catch (error) {
      console.error("Error generating script:", error);
      setError('Failed to generate script. Check backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtractCast = async () => {
    if (!currentProject) return;
    setIsExtracting(true);
    setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/extract-cast?episode=${selectedEpisode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });

      const data = await response.json();
      console.log("Extract Cast response:", JSON.stringify(data, null, 2));
      if (data.status === 'error') {
        setError(data.details);
        return;
      }
      const castValue = data.cast || '';
      console.log("Cast value length:", castValue.length);
      updateDraft({ cast: castValue, formattedCast: formatCast(castValue) });

      // Fetch existing project-level assets for the comparison modal
      const assetsRes = await fetch(`${baseUrl}/projects/${currentProject.id}/assets`);
      const assetsData = await assetsRes.json();
      if (assetsData.status === 'success' && assetsData.assets) {
        const all: { id: string; name: string; type: string }[] = [];
        for (const list of [assetsData.assets.characters, assetsData.assets.locations, assetsData.assets.props]) {
          for (const a of list || []) {
            all.push({ id: a.id, name: a.name, type: a.type });
          }
        }
        setExistingAssetsList(all);
      }

      // Show the comparison modal
      if (data.comparison) {
        setComparisonData(data.comparison);
      }
    } catch (error) {
      console.error("Error extracting cast:", error);
      setError('Failed to extract cast. Check backend connection.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRefineDialog = async () => {
    if (!currentProject) return;
    setIsRefining(true);
    setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/refine-dialog?episode=${selectedEpisode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });
      const data = await response.json();
      if (data.status === 'error') {
        setError(data.details);
        return;
      }
      updateDraft({ refinedScript: data.script || '' });
    } catch (error) {
      console.error("Error refining dialog:", error);
      setError('Failed to refine dialog. Check backend connection.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleApplyRefinement = () => {
    updateDraft({ script: refinedScript, refinedScript: '' });
  };

  const formatCast = (json: string): string => {
    try {
      let text = json.trim();
      if (text.startsWith("```")) {
        text = text.split("```")[1];
        if (text.startsWith("json")) text = text.slice(4);
      }
      const data = JSON.parse(text);
      let formatted = "";

      if (data.characters?.length) {
        formatted += "CHARACTERS\n";
        formatted += "=".repeat(40) + "\n\n";
        for (const c of data.characters) {
          formatted += `• ${c.name}\n`;
          formatted += `  ${c.description || ''}\n`;
          for (const s of c.states || []) {
            formatted += `  - ${s.name}: ${s.description || ''} (Scenes: ${s.scenes?.join(', ') || 'N/A'})\n`;
          }
          formatted += "\n";
        }
      }

      if (data.locations?.length) {
        formatted += "LOCATIONS\n";
        formatted += "=".repeat(40) + "\n\n";
        for (const l of data.locations) {
          formatted += `• ${l.name}\n`;
          formatted += `  ${l.description || ''}\n`;
          for (const s of l.states || []) {
            formatted += `  - ${s.name}: ${s.description || ''} (Scenes: ${s.scenes?.join(', ') || 'N/A'})\n`;
          }
          formatted += "\n";
        }
      }

      if (data.props?.length) {
        formatted += "PROPS\n";
        formatted += "=".repeat(40) + "\n\n";
        for (const p of data.props) {
          formatted += `• ${p.name}\n`;
          formatted += `  ${p.description || ''}\n`;
          formatted += `  Characters: ${p.associatedCharacters?.join(', ') || 'N/A'}\n`;
          formatted += `  Scenes: ${p.scenes?.join(', ') || 'N/A'}\n\n`;
        }
      }

      return formatted.trim();
    } catch (e) {
      return json;
    }
  };

  const handleSave = async () => {
    if (!currentProject) return;
    setIsSaving(true);
    setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;

      // Save script only
      const scriptRes = await fetch(`${baseUrl}/projects/${currentProject.id}/script?episode=${selectedEpisode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: script }),
      });
      if (!scriptRes.ok) throw new Error('Failed to save script');

      // Update local store to reflect the saved script
      const { setCurrentProject } = useProjectStore.getState();
      setCurrentProject({
        ...currentProject,
        script: { id: currentProject.script?.id || 'pending', content: script } as Script
      });
      // Clear draft after successful save
      setScriptDraft(null);
    } catch (error) {
      console.error("Error saving:", error);
      setError('Failed to save. Check backend connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCast = async () => {
    if (!currentProject || !cast) return;
    if (!window.confirm('Save the extracted cast to assets? Existing assets with matching names will be updated; others are kept.')) return;
    setIsSaving(true);
    setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const assetsRes = await fetch(`${baseUrl}/projects/${currentProject.id}/save-assets?episode=${selectedEpisode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cast }),
      });
      const data = await assetsRes.json();
      if (data.status === 'error') {
        setError(data.details);
        return;
      }
      setHasSavedAssets(true);
    } catch (error) {
      console.error("Error saving cast:", error);
      setError('Failed to save cast. Check backend connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleComparisonConfirm = async (selections: any[]) => {
    if (!currentProject) return;
    setComparisonData(null);
    setIsSaving(true);
    setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const assetsRes = await fetch(`${baseUrl}/projects/${currentProject.id}/save-assets?episode=${selectedEpisode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      });
      const data = await assetsRes.json();
      if (data.status === 'error') {
        setError(data.details);
        return;
      }
      setHasSavedAssets(true);
      // Refresh the cast display from the saved assets
      const assetsRes2 = await fetch(`${baseUrl}/projects/${currentProject.id}/assets`);
      const assetsData2 = await assetsRes2.json();
      if (assetsData2.status === 'success' && assetsData2.assets) {
        const json = JSON.stringify(assetsData2.assets, null, 2);
        updateDraft({ cast: json, formattedCast: formatCast(json) });
      }
    } catch (error) {
      console.error("Error saving selections:", error);
      setError('Failed to save selections. Check backend connection.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {currentProject?.type === 'episodic' && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">Episode:</label>
          <span className="text-sm text-muted-foreground">Episode {selectedEpisode}</span>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-2 text-foreground">Script</h3>
        <textarea
          className="w-full p-4 border border-border rounded bg-card text-foreground resize-y"
          rows={15}
          placeholder="Script will appear here after generating from the Story tab..."
          value={script}
          onChange={(e) => updateDraft({ script: e.target.value })}
        />
      </div>

      {error && (
        <div className="p-4 border border-destructive/40 bg-destructive/10 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
        Workflow: Finalise script → Extract Assets → Add character traits → Refine dialog → Choose to overwrite script or not
      </p>

      <div className="flex justify-center gap-4 mt-2">
        <button
          onClick={handleGenerateScript}
          disabled={isLoading || !currentProject?.story?.narrativeArc}
          className="px-6 py-2 bg-accent text-accent-foreground rounded hover:bg-accent/80 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Generating...' : script ? 'Regenerate Script' : 'Generate Script'}
        </button>
        <button
          onClick={handleRefineDialog}
          disabled={isRefining || !script || !hasSavedAssets}
          title={!hasSavedAssets ? 'Save assets first (Extract Assets → Save Cast)' : ''}
          className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {isRefining ? 'Refining...' : 'Refine Dialog'}
        </button>
        <button
          onClick={handleExtractCast}
          disabled={isExtracting || !script}
          className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {isExtracting ? 'Extracting...' : 'Extract Assets'}
        </button>
      </div>

      {refinedScript && (
        <div className="space-y-2 mt-4">
          <h3 className="text-lg font-semibold text-teal-400">Refined Dialog</h3>
          <textarea
            className="w-full p-4 border border-teal-800 rounded bg-teal-950/40 text-foreground resize-y"
            rows={15}
            value={refinedScript}
            onChange={(e) => updateDraft({ refinedScript: e.target.value })}
          />
          <div className="flex justify-center">
            <button
              onClick={handleApplyRefinement}
              className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
            >
              Apply Dialog Refinement
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 mt-4">
        <h3 className="text-lg font-semibold text-foreground">Extracted Assets</h3>
        <textarea
          className="w-full p-4 border border-border rounded bg-purple-950/30 text-foreground whitespace-pre-wrap resize-y"
          rows={10}
          value={formattedCast || cast}
          onChange={(e) => {
            const val = e.target.value;
            // Try to parse as JSON — if valid, store raw JSON and show formatted
            try {
              let text = val.trim();
              if (text.startsWith("```")) {
                text = text.split("```")[1];
                if (text.startsWith("json")) text = text.slice(4);
              }
              JSON.parse(text);
              updateDraft({ cast: val, formattedCast: formatCast(val) });
            } catch {
              // Not valid JSON — keep the previous raw JSON for saving
              updateDraft({ formattedCast: val });
            }
          }}
          placeholder="Paste JSON here or use Extract Assets..."
        />
      </div>

      <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-border">
        <button
          onClick={handleSave}
          disabled={isSaving || !script}
          className="px-6 py-2 bg-muted text-foreground rounded hover:bg-muted/80 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleSaveCast}
          disabled={isSaving || !cast}
          className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          Save Cast
        </button>
        {hasSavedAssets && onNavigateToAssets && (
          <button
            onClick={onNavigateToAssets}
            className="px-6 py-2 bg-success text-white rounded hover:bg-success/80 transition-colors"
          >
            Next
          </button>
        )}
      </div>

      {comparisonData && (
        <ExtractComparisonModal
          comparison={comparisonData}
          existingAssets={existingAssetsList}
          onConfirm={handleComparisonConfirm}
          onCancel={() => setComparisonData(null)}
        />
      )}
    </div>
  );
};

export default ScriptStage;
