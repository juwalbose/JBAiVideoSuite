import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';

interface ShotData {
  shot: number;
  scene: number;
  beats: number[];
  duration: number;
  camera: string;
  action: string;
  dialogue: string;
  locationAssetId: string | null;
  locationStateId: string | null;
  characterAssetIds: string[];
  characterStateIds: string[];
  propAssetIds: string[];
  propStateIds: string[];
  sceneDialogAudioId: string | null;
  characterAudioIds: string[];
  musicOn: boolean;
  musicDesc: string;
}

interface TakeData {
  id: string;
  endShotIndex: number;
  prompt: string;
}

interface AssetItem {
  id: string;
  name: string;
  description: string;
  states: { id: string; name: string; description: string }[];
}

const parseJsonArray = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.startsWith('[')) {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
};

const mapShot = (s: any): ShotData => ({
  shot: Number(s.shot) || 0,
  scene: Number(s.scene) || 0,
  beats: Array.isArray(s.beats) ? s.beats.map(Number) : (typeof s.beats === 'string' ? s.beats.replace(/[\[\]]/g, '').split(',').map((x: string) => Number(x.trim())).filter((n: number) => !isNaN(n)) : []),
  duration: Number(s.duration) || 0,
  camera: s.camera || '',
  action: s.action || '',
  dialogue: s.dialogue || '',
  locationAssetId: s.locationAssetId || null,
  locationStateId: s.locationStateId || null,
  characterAssetIds: parseJsonArray(s.characterAssetIds),
  characterStateIds: parseJsonArray(s.characterStateIds),
  propAssetIds: parseJsonArray(s.propAssetIds),
  propStateIds: parseJsonArray(s.propStateIds),
  sceneDialogAudioId: s.sceneDialogAudioId || null,
  characterAudioIds: parseJsonArray(s.characterAudioIds),
  musicOn: s.musicOn === true || s.musicOn === 'true',
  musicDesc: s.musicDesc || '',
});

const TakesStage = ({ selectedEpisode }: { selectedEpisode: number }) => {
  const { currentProject } = useProjectStore();
  const { backend } = useSettingsStore();

  const [shots, setShots] = useState<ShotData[]>([]);
  const [takes, setTakes] = useState<TakeData[]>([]);
  const [selectedTakeIdx, setSelectedTakeIdx] = useState(0);
  const [projectAssets, setProjectAssets] = useState<{ characters: AssetItem[]; locations: AssetItem[]; props: AssetItem[] }>({ characters: [], locations: [], props: [] });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [genPromptLoading, setGenPromptLoading] = useState(false);

  // Fetch shots and takes on mount
  useEffect(() => {
    if (!currentProject) return;
    const baseUrl = backend.apiUrl;
    fetch(`${baseUrl}/projects/${currentProject.id}/shotlist?episode=${selectedEpisode}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setShots(data.map(mapShot));
      })
      .catch(console.error);
    fetch(`${baseUrl}/projects/${currentProject.id}/takes?episode=${selectedEpisode}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTakes(data);
          setSelectedTakeIdx(0);
        }
      })
      .catch(console.error);
  }, [currentProject?.id, selectedEpisode, backend.apiUrl]);

  // Fetch assets
  useEffect(() => {
    if (!currentProject) return;
    const baseUrl = useSettingsStore.getState().backend.apiUrl;
    fetch(`${baseUrl}/projects/${currentProject.id}/assets?episode=${selectedEpisode}`)
      .then((r) => r.json())
      .then((data) => { if (data.status === 'success') setProjectAssets(data.assets); })
      .catch(console.error);
  }, [currentProject?.id, selectedEpisode]);

  const totalShots = shots.length;

  // Compute start shot for a given take index
  const getStartShot = (takeIdx: number): number => {
    if (takeIdx === 0) return 1;
    const prevTake = takes[takeIdx - 1];
    return prevTake ? prevTake.endShotIndex + 1 : 1;
  };

  // Compute max end shot for a given take index
  const getMaxEndShot = (takeIdx: number): number => {
    if (takeIdx === takes.length - 1) return totalShots;
    const nextTake = takes[takeIdx + 1];
    return nextTake ? nextTake.endShotIndex - 1 : totalShots;
  };

  const addTake = () => {
    if (totalShots < 2) { setError('Need at least 2 shots to create a take.'); return; }
    const lastEnd = takes.length > 0 ? takes[takes.length - 1].endShotIndex : 0;
    const newEnd = lastEnd + 2; // minimum: start + 1
    if (newEnd > totalShots) { setError('No more shots available to add a take.'); return; }
    const newTake: TakeData = { id: '', endShotIndex: newEnd, prompt: '' };
    setTakes((prev) => [...prev, newTake]);
    setSelectedTakeIdx(takes.length);
    setError('');
    setSaved(false);
  };

  const deleteTake = async (idx: number) => {
    if (!currentProject) return;
    const take = takes[idx];
    if (!take || !take.id) {
      // Not saved yet — just remove from local state
      setTakes((prev) => prev.filter((_, i) => i !== idx));
      setSelectedTakeIdx((si) => Math.max(0, si >= idx ? si - 1 : si));
      return;
    }
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      await fetch(`${baseUrl}/projects/${currentProject.id}/takes/${take.id}?episode=${selectedEpisode}`, {
        method: 'DELETE',
      });
      setTakes((prev) => prev.filter((_, i) => i !== idx));
      setSelectedTakeIdx((si) => Math.max(0, si >= idx ? si - 1 : si));
    } catch (err) {
      console.error('Error deleting take:', err);
      setError('Failed to delete take.');
    }
  };

  const updateEndShot = (idx: number, newEnd: number) => {
    setTakes((prev) => prev.map((t, i) => (i === idx ? { ...t, endShotIndex: newEnd } : t)));
    setSaved(false);
  };

  const updatePrompt = (idx: number, prompt: string) => {
    setTakes((prev) => prev.map((t, i) => (i === idx ? { ...t, prompt } : t)));
    setSaved(false);
  };

  const generateTakePrompt = async (idx: number) => {
    if (!currentProject) return;
    setGenPromptLoading(true);
    setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const take = takes[idx];
      const start = getStartShot(idx);
      const end = take.endShotIndex;
      const takeShots = shots.filter((s) => s.shot >= start && s.shot <= end);
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/takes/generate-prompt?episode=${selectedEpisode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shots: takeShots, endShotIndex: end }),
      });
      const data = await response.json();
      if (data.status === 'error') { setError(data.details); return; }
      setTakes((prev) => prev.map((t, i) => (i === idx ? { ...t, prompt: data.prompt } : t)));
      setSaved(false);
    } catch (err) {
      console.error('Error generating take prompt:', err);
      setError('Failed to generate take prompt.');
    } finally {
      setGenPromptLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentProject) return;
    setIsSaving(true);
    setError('');
    setSaved(false);
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/takes?episode=${selectedEpisode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ takes }),
      });
      const data = await response.json();
      if (data.status === 'error') { setError(data.details); return; }
      // Re-fetch to get IDs
      const refetch = await fetch(`${baseUrl}/projects/${currentProject.id}/takes?episode=${selectedEpisode}`);
      const refetched = await refetch.json();
      if (Array.isArray(refetched)) setTakes(refetched);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error saving takes:', err);
      setError('Failed to save takes.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedTake = takes[selectedTakeIdx];

  // Compute shots in the selected take
  const getTakeShots = (takeIdx: number): ShotData[] => {
    const start = getStartShot(takeIdx);
    const end = takes[takeIdx]?.endShotIndex || 0;
    return shots.filter((s) => s.shot >= start && s.shot <= end);
  };

  const takeShots = selectedTake ? getTakeShots(selectedTakeIdx) : [];
  const totalDuration = takeShots.reduce((sum, s) => sum + s.duration, 0);

  // Consolidated asset states (asset + specific state)
  interface AssetStateRef {
    assetId: string;
    assetName: string;
    stateId: string | null;
    stateName: string;
  }

  const consolidatedStates = (() => {
    const locs = new Map<string, AssetStateRef>();
    const chars = new Map<string, AssetStateRef>();
    const props = new Map<string, AssetStateRef>();

    for (const s of takeShots) {
      if (s.locationAssetId) {
        const a = projectAssets.locations.find((x) => x.id === s.locationAssetId);
        if (a) {
          const st = a.states.find((x) => x.id === s.locationStateId);
          const key = `${a.id}|${s.locationStateId || ''}`;
          locs.set(key, { assetId: a.id, assetName: a.name, stateId: s.locationStateId, stateName: st?.name || a.name });
        }
      }
      for (let i = 0; i < s.characterAssetIds.length; i++) {
        const cid = s.characterAssetIds[i];
        if (!cid) continue;
        const a = projectAssets.characters.find((x) => x.id === cid);
        if (a) {
          const sid = s.characterStateIds[i] || null;
          const st = a.states.find((x) => x.id === sid);
          const key = `${a.id}|${sid || ''}`;
          chars.set(key, { assetId: a.id, assetName: a.name, stateId: sid, stateName: st?.name || a.name });
        }
      }
      for (let i = 0; i < s.propAssetIds.length; i++) {
        const pid = s.propAssetIds[i];
        if (!pid) continue;
        const a = projectAssets.props.find((x) => x.id === pid);
        if (a) {
          const sid = s.propStateIds[i] || null;
          const st = a.states.find((x) => x.id === sid);
          const key = `${a.id}|${sid || ''}`;
          props.set(key, { assetId: a.id, assetName: a.name, stateId: sid, stateName: st?.name || a.name });
        }
      }
    }

    return {
      locations: Array.from(locs.values()),
      characters: Array.from(chars.values()),
      props: Array.from(props.values()),
    };
  })();

  // Consolidated action texts
  const actionTexts = takeShots.map((s) => `Shot ${s.shot}: ${s.action}`).join('\n');

  return (
    <div className="space-y-4">
      {currentProject?.type === 'episodic' && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground">Episode:</label>
          <span className="text-sm text-muted-foreground">Episode {selectedEpisode}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Takes ({takes.length})</h3>
        <div className="flex items-center gap-2">
          <button onClick={addTake} className="px-3 py-1 bg-accent text-accent-foreground rounded hover:bg-accent/80 text-sm">
            + Add Take
          </button>
          {takes.length > 0 && (
            <button onClick={() => deleteTake(takes.length - 1)} className="px-3 py-1 bg-destructive text-white rounded hover:bg-red-700 text-sm">
              Delete Last Take
            </button>
          )}
          {takes.length > 0 && (
            <button onClick={handleSave} disabled={isSaving} className="px-3 py-1 bg-success text-white rounded hover:bg-success/80 text-sm disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save Takes'}
            </button>
          )}
        </div>
      </div>

      {shots.length === 0 && (
        <div className="p-4 border border-border rounded bg-muted text-muted-foreground text-sm text-center">
          No shots yet. Go to the Shot List tab and generate shots first.
        </div>
      )}

      {takes.length === 0 && shots.length > 0 && (
        <div className="p-4 border border-border rounded bg-muted text-muted-foreground text-sm text-center">
          No takes yet. Click "+ Add Take" to create one.
        </div>
      )}

      {takes.length > 0 && selectedTake && (
        <div className="p-4 border border-border rounded-lg bg-card shadow-sm space-y-4">
          {/* Take selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">Take:</label>
            <select
              className="px-3 py-1 border border-border rounded text-sm bg-card text-foreground"
              value={selectedTakeIdx}
              onChange={(e) => setSelectedTakeIdx(Number(e.target.value))}
            >
              {takes.map((t, i) => (
                <option key={i} value={i}>Take {i + 1} (ends at shot {t.endShotIndex})</option>
              ))}
            </select>

          </div>

          {/* End shot selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">End Shot:</label>
            <select
              className="px-3 py-1 border border-border rounded text-sm bg-card text-foreground"
              value={selectedTake.endShotIndex}
              onChange={(e) => updateEndShot(selectedTakeIdx, Number(e.target.value))}
            >
              {Array.from({ length: getMaxEndShot(selectedTakeIdx) - getStartShot(selectedTakeIdx) + 1 }, (_, i) => {
                const shotNum = getStartShot(selectedTakeIdx) + 1 + i;
                return (
                  <option key={shotNum} value={shotNum}>
                    Shot {shotNum}
                  </option>
                );
              })}
            </select>
            <span className="text-sm text-muted-foreground">
              (shots {getStartShot(selectedTakeIdx)}–{selectedTake.endShotIndex})
            </span>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Total Duration:</label>
            <span className="text-sm text-accent font-mono">{totalDuration.toFixed(2)}s</span>
            {totalDuration > 15 && (
              <span className="text-xs text-destructive">⚠ exceeds 15s</span>
            )}
          </div>

          {/* Consolidated actions */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Consolidated Actions</h4>
            <div className="p-3 border border-border rounded bg-muted/30 text-sm text-foreground font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
              {actionTexts || 'No actions'}
            </div>
          </div>

          {/* Consolidated assets */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Consolidated Assets</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Locations</label>
                {consolidatedStates.locations.length > 0 ? (
                  consolidatedStates.locations.map((a) => (
                    <div key={`${a.assetId}-${a.stateId}`} className="text-foreground mb-1">• {a.assetName} — {a.stateName}</div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">None</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Characters</label>
                {consolidatedStates.characters.length > 0 ? (
                  consolidatedStates.characters.map((a) => (
                    <div key={`${a.assetId}-${a.stateId}`} className="text-foreground mb-1">• {a.assetName} — {a.stateName}</div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">None</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Props</label>
                {consolidatedStates.props.length > 0 ? (
                  consolidatedStates.props.map((a) => (
                    <div key={`${a.assetId}-${a.stateId}`} className="text-foreground mb-1">• {a.assetName} — {a.stateName}</div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">None</p>
                )}
              </div>
            </div>
          </div>

          {/* Prompt */}
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Prompt</label>
              <textarea
                className="w-full px-2 py-1 border border-border rounded text-sm bg-card text-foreground resize-y"
                rows={12}
                value={selectedTake.prompt}
                onChange={(e) => updatePrompt(selectedTakeIdx, e.target.value)}
                placeholder="Generate or edit the consolidated prompt for this take..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => generateTakePrompt(selectedTakeIdx)}
                disabled={genPromptLoading}
                className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 whitespace-nowrap disabled:opacity-50"
              >
                {genPromptLoading ? 'Generating...' : 'Generate Prompt'}
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(selectedTake.prompt)}
                disabled={!selectedTake.prompt}
                className="px-6 py-2 bg-muted text-foreground rounded hover:bg-muted/80 whitespace-nowrap disabled:opacity-50"
              >
                Copy Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 border border-destructive/40 bg-destructive/10 rounded-lg text-destructive text-sm">{error}</div>
      )}

      {saved && (
        <div className="p-3 border border-success/40 bg-success/10 rounded-lg text-success text-sm">
          Takes saved successfully.
        </div>
      )}
    </div>
  );
};

export default TakesStage;
