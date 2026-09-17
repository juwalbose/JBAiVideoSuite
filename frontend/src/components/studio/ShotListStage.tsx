import React, { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';

interface ShotData {
  id: string;
  shot: number;
  scene: number;
  beats: number[];
  loc: string;
  subs: string;
  frames: number;
  duration: number;
  camera: string;
  action: string;
  dialogue: string;
  note: string;
  prompt: string;
  locationAssetId: string | null;
  locationStateId: string | null;
  characterAssetIds: string[];
  characterStateIds: string[];
  propAssetIds: string[];
  propStateIds: string[];
  sceneDialogAudioId: string | null;
  characterAudioIds: string[];
  characterAudioTypes: string[];
  musicOn: boolean;
  musicDesc: string;
  videoPath: string | null;
}

interface AssetState {
  id: string;
  name: string;
  description: string;
}

interface AssetItem {
  id: string;
  name: string;
  description: string;
  states: AssetState[];
}

const ShotListStage = ({ selectedEpisode, takesEnabled, onTakesEnabledChange }: { selectedEpisode: number; takesEnabled: boolean; onTakesEnabledChange: (v: boolean) => void }) => {
  const { currentProject } = useProjectStore();
  const [shots, setShots] = useState<ShotData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [rawShots, setRawShots] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // M33: use the hook so the effect re-runs when apiUrl changes
  const { backend } = useSettingsStore();

  useEffect(() => {
    if (!currentProject) return;
    const baseUrl = backend.apiUrl;
    fetch(`${baseUrl}/projects/${currentProject.id}/shotlist?episode=${selectedEpisode}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setShots(data.map(mapShot));
          setSelectedIdx(0);
        }
      })
      .catch(console.error);
  }, [currentProject?.id, selectedEpisode, backend.apiUrl]);

  // M32/M34: safe JSON.parse that returns [] on failure
  const parseJsonArray = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.startsWith('[')) {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  };

  const mapShot = (s: any): ShotData => ({
    id: s.id || '',
    shot: Number(s.shot) || 0,
    scene: Number(s.scene) || 0,
    beats: Array.isArray(s.beats) ? s.beats.map(Number) : (typeof s.beats === 'string' ? s.beats.replace(/[\[\]]/g, '').split(',').map((x: string) => Number(x.trim())).filter((n: number) => !isNaN(n)) : []),
    loc: s.loc || '',
    subs: Array.isArray(s.subs) ? s.subs.join(', ') : (typeof s.subs === 'string' ? (s.subs.startsWith('[') ? parseJsonArray(s.subs).join(', ') : s.subs) : ''),
    frames: Number(s.frames) || 0,
    duration: Number(s.duration) || 0,
    camera: s.camera || '',
    action: s.action || '',
    dialogue: s.dialogue || '',
    note: s.note || '',
    prompt: s.prompt || '',
    locationAssetId: s.locationAssetId || null,
    locationStateId: s.locationStateId || null,
    characterAssetIds: parseJsonArray(s.characterAssetIds),
    characterStateIds: parseJsonArray(s.characterStateIds),
    propAssetIds: parseJsonArray(s.propAssetIds),
    propStateIds: parseJsonArray(s.propStateIds),
    sceneDialogAudioId: s.sceneDialogAudioId || null,
    characterAudioIds: parseJsonArray(s.characterAudioIds),
    characterAudioTypes: parseJsonArray(s.characterAudioTypes),
    musicOn: s.musicOn === true || s.musicOn === 'true',
    musicDesc: s.musicDesc || '',
    videoPath: s.videoPath || null,
  });

  const parseShots = (raw: string): ShotData[] => {
    const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '');
    try {
      const parsed = JSON.parse(cleaned);
      const arr = Array.isArray(parsed) ? parsed : parsed.shots || [];
      return arr.map(mapShot);
    } catch {
      const shots: ShotData[] = [];
      const shotStart = cleaned.indexOf('{');
      if (shotStart === -1) return [];
      let depth = 0, inString = false, escape = false, objStart = -1;
      for (let i = shotStart; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') { if (depth === 0) objStart = i; depth++; }
        else if (ch === '}') {
          depth--;
          if (depth === 0 && objStart !== -1) {
            try {
              const obj = JSON.parse(cleaned.slice(objStart, i + 1));
              if (obj.shot !== undefined) shots.push(mapShot(obj));
            } catch { /* skip */ }
            objStart = -1;
          }
        }
      }
      return shots;
    }
  };

  const loadFromRaw = () => {
    const parsed = parseShots(rawShots);
    if (parsed.length === 0) { setError('Could not parse JSON from raw output.'); return; }
    setShots(parsed);
    setSelectedIdx(0);
    setError('');
    setSaved(false);
  };

  const handleGenerateShots = async () => {
    if (!currentProject) return;
    setIsLoading(true);
    setError('');
    setSaved(false);
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/generate-shots?episode=${selectedEpisode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.status === 'error') { setError(data.details); return; }
      const raw = data.shots || '';
      setRawShots(raw);
      const parsed = parseShots(raw);
      if (parsed.length === 0) setError('Could not parse shots. Paste raw JSON below and click Load.');
      setShots(parsed);
      setSelectedIdx(0);
    } catch (err) {
      console.error('Error generating shots:', err);
      setError('Failed to generate shots. Check backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentProject) return;
    setIsSaving(true);
    setError('');
    setSaved(false);
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/shotlist?episode=${selectedEpisode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shots }),
      });
      const data = await response.json();
      if (data.status === 'error') { setError(data.details); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error saving shots:', err);
      setError('Failed to save shots.');
    } finally {
      setIsSaving(false);
    }
  };

  const [genPromptLoading, setGenPromptLoading] = useState(false);
  const [genAll, setGenAll] = useState<{ active: boolean; current: number; total: number; done: number; failed: number } | null>(null);
  const abortRef = useRef(false);
  const [projectAssets, setProjectAssets] = useState<{ characters: AssetItem[]; locations: AssetItem[]; props: AssetItem[] }>({ characters: [], locations: [], props: [] });
  const [audioAssets, setAudioAssets] = useState<{ id: string; name: string; audioType: string }[]>([]);

  useEffect(() => {
    if (!currentProject) return;
    const baseUrl = useSettingsStore.getState().backend.apiUrl;
    fetch(`${baseUrl}/projects/${currentProject.id}/assets?episode=${selectedEpisode}`)
      .then((r) => r.json())
      .then((data) => { if (data.status === 'success') setProjectAssets(data.assets); })
      .catch(console.error);
    fetch(`${baseUrl}/projects/${currentProject.id}/audio?episode=${selectedEpisode}`)
      .then((r) => r.json())
      .then((data) => { if (data.status === 'success') setAudioAssets(data.audio); })
      .catch(console.error);
  }, [currentProject?.id, selectedEpisode]);

  const generatePrompt = async (index: number) => {
    if (!currentProject) return;
    setGenPromptLoading(true);
    setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const shot = shots[index];
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/shotlist/generate-prompt?episode=${selectedEpisode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shot),
      });
      const data = await response.json();
      if (data.status === 'error') { setError(data.details); return; }
      setShots((prev) => prev.map((s, i) => (i === index ? { ...s, prompt: data.prompt } : s)));
      setSaved(false);
    } catch (err) {
      console.error('Error generating prompt:', err);
      setError('Failed to generate prompt.');
    } finally {
      setGenPromptLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!currentProject || shots.length === 0) return;
    abortRef.current = false;
    const baseUrl = useSettingsStore.getState().backend.apiUrl;
    setGenAll({ active: true, current: 0, total: shots.length, done: 0, failed: 0 });
    // Build a local copy so we save the freshly computed list, not the stale closure
    const localShots = [...shots];
    let done = 0, failed = 0;
    for (let i = 0; i < localShots.length; i++) {
      if (abortRef.current) break;
      setGenAll({ active: true, current: i + 1, total: localShots.length, done, failed });
      try {
        const response = await fetch(`${baseUrl}/projects/${currentProject.id}/shotlist/generate-prompt?episode=${selectedEpisode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localShots[i]),
        });
        const data = await response.json();
        if (data.status === 'error') throw new Error(data.details);
        localShots[i] = { ...localShots[i], prompt: data.prompt };
        setShots((prev) => prev.map((s, idx) => (idx === i ? { ...s, prompt: data.prompt } : s)));
        done++;
      } catch { failed++; }
      setGenAll({ active: true, current: i + 1, total: localShots.length, done, failed });
    }
    setGenAll({ active: false, current: localShots.length, total: localShots.length, done, failed });
    if (!abortRef.current && done > 0) {
      // Save the freshly computed list directly
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/shotlist?episode=${selectedEpisode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shots: localShots }),
      });
      const data = await response.json();
      if (data.status === 'error') { setError(data.details); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const updateShot = (index: number, field: keyof ShotData, value: string | number | boolean | number[] | string[] | null) => {
    setShots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    setSaved(false);
  };

  const deleteShot = async (index: number) => {
    const shot = shots[index];
    if (!shot) return;
    if (shot.id) {
      try {
        const baseUrl = useSettingsStore.getState().backend.apiUrl;
        await fetch(`${baseUrl}/projects/${currentProject!.id}/shotlist/${shot.id}?episode=${selectedEpisode}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Error deleting shot:', err);
        setError('Failed to delete shot.');
        return;
      }
    }
    setShots((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setSelectedIdx((si) => (si >= next.length ? Math.max(0, next.length - 1) : si));
      return next;
    });
    setSaved(false);
  };

  const addShot = () => {
    const nextNum = shots.length > 0 ? Math.max(...shots.map((s) => s.shot)) + 1 : 1;
    setShots((prev) => [...prev, { shot: nextNum, scene: 0, beats: [], loc: '', subs: '', frames: 0, duration: 0, camera: '', action: '', dialogue: '', note: '', prompt: '', locationAssetId: null, locationStateId: null, characterAssetIds: [], characterStateIds: [], propAssetIds: [], propStateIds: [], sceneDialogAudioId: null, characterAudioIds: [], characterAudioTypes: [], musicOn: false, musicDesc: '', videoPath: null }]);
    setSelectedIdx(shots.length);
    setSaved(false);
  };

  const shot = shots[selectedIdx];

  const numField = (label: string, value: number, onChange: (v: number) => void) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input type="number" className="w-full px-2 py-1 border border-border rounded text-sm bg-card text-foreground"
        value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );

  const textField = (label: string, value: string, onChange: (v: string) => void, rows = 3) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      <textarea className="w-full px-2 py-1 border border-border rounded text-sm bg-card text-foreground resize-y"
        rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  return (
    <div className="space-y-4">
      {currentProject?.type === 'episodic' && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground">Episode:</label>
          <span className="text-sm text-muted-foreground">Episode {selectedEpisode}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-foreground">Shot List ({shots.length} shots)</h3>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={takesEnabled}
              onChange={(e) => onTakesEnabledChange(e.target.checked)}
              className="rounded border-border"
            />
            Enable Takes
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addShot} className="px-3 py-1 bg-accent text-accent-foreground rounded hover:bg-accent/80 text-sm">
            + Add Shot
          </button>
          <button onClick={handleGenerateAll} disabled={genAll?.active || shots.length === 0}
            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm disabled:opacity-50">
            {genAll?.active ? `Generating ${genAll.current}/${genAll.total}...` : '⚡ Generate All Prompts'}
          </button>
          {genAll?.active && (
            <button onClick={() => { abortRef.current = true; }} className="px-3 py-1 bg-destructive text-white rounded hover:bg-red-700 text-sm">
              Stop
            </button>
          )}
        </div>
      </div>
      {genAll && !genAll.active && (genAll.done > 0 || genAll.failed > 0) && (
        <p className="text-xs text-muted-foreground">{genAll.done} done, {genAll.failed} failed</p>
      )}

      {shots.length > 0 && shot && (
        <div className="p-4 border border-border rounded-lg bg-card shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
                disabled={selectedIdx === 0}
                className="px-2 py-1 bg-muted text-foreground rounded text-xs hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <select
                className="px-3 py-1 border border-border rounded text-sm bg-card text-foreground"
                value={selectedIdx}
                onChange={(e) => setSelectedIdx(Number(e.target.value))}
              >
                {shots.map((s, i) => (
                  <option key={i} value={i}>Shot {s.shot}</option>
                ))}
              </select>
              <button
                onClick={() => setSelectedIdx(Math.min(shots.length - 1, selectedIdx + 1))}
                disabled={selectedIdx === shots.length - 1}
                className="px-2 py-1 bg-muted text-foreground rounded text-xs hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
            <button onClick={() => deleteShot(selectedIdx)} className="px-3 py-1 bg-destructive text-white rounded text-xs hover:bg-red-700">
              Delete Shot
            </button>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {numField('Shot #', shot.shot, (v) => updateShot(selectedIdx, 'shot', v))}
            {numField('Scene', shot.scene, (v) => updateShot(selectedIdx, 'scene', v))}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Beats</label>
              <input type="text" className="w-full px-2 py-1 border border-border rounded text-sm bg-card text-foreground"
                value={shot.beats.join(', ')}
                onChange={(e) => {
                  const nums = e.target.value.split(',').map((x) => Number(x.trim())).filter((n) => !isNaN(n));
                  updateShot(selectedIdx, 'beats', nums);
                }}
              />
            </div>
            {numField('Frames', shot.frames, (v) => updateShot(selectedIdx, 'frames', v))}
            {numField('Duration (s)', shot.duration, (v) => updateShot(selectedIdx, 'duration', v))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {textField('Location', shot.loc, (v) => updateShot(selectedIdx, 'loc', v), 1)}
            {textField('Subjects', shot.subs, (v) => updateShot(selectedIdx, 'subs', v), 1)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {textField('Camera', shot.camera, (v) => updateShot(selectedIdx, 'camera', v))}
            {textField('Action', shot.action, (v) => updateShot(selectedIdx, 'action', v))}
          </div>
          {textField('Dialogue', shot.dialogue, (v) => updateShot(selectedIdx, 'dialogue', v))}
          {textField('Note', shot.note, (v) => updateShot(selectedIdx, 'note', v), 1)}
          <div className="border-t border-border pt-3">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Linked Assets</h4>
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Location</label>
                <select
                  className="w-full px-2 py-1 border border-border rounded text-sm bg-card text-foreground"
                  value={shot.locationAssetId && shot.locationStateId ? `${shot.locationAssetId}|${shot.locationStateId}` : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      updateShot(selectedIdx, 'locationAssetId', null);
                      updateShot(selectedIdx, 'locationStateId', null);
                    } else {
                      const [aid, sid] = val.split('|');
                      updateShot(selectedIdx, 'locationAssetId', aid);
                      updateShot(selectedIdx, 'locationStateId', sid);
                    }
                  }}
                >
                  <option value="">None</option>
                  {projectAssets.locations.map((a) => (
                    <optgroup key={a.id} label={a.name}>
                      {a.states.map((st) => (
                        <option key={st.id} value={`${a.id}|${st.id}`}>{st.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Characters</label>
                {shot.characterAssetIds.map((aid, i) => (
                  <select
                    key={i}
                    className="w-full px-2 py-1 border border-border rounded text-sm bg-card text-foreground mb-1"
                    value={shot.characterStateIds[i] ? `${aid}|${shot.characterStateIds[i]}` : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        const newIds = shot.characterAssetIds.filter((_, j) => j !== i);
                        const newStates = shot.characterStateIds.filter((_, j) => j !== i);
                        const newAudioIds = shot.characterAudioIds.filter((_, j) => j !== i);
                        const newAudioTypes = shot.characterAudioTypes.filter((_, j) => j !== i);
                        updateShot(selectedIdx, 'characterAssetIds', newIds);
                        updateShot(selectedIdx, 'characterStateIds', newStates);
                        updateShot(selectedIdx, 'characterAudioIds', newAudioIds);
                        updateShot(selectedIdx, 'characterAudioTypes', newAudioTypes);
                      } else {
                        const [newAid, newSid] = val.split('|');
                        const newIds = [...shot.characterAssetIds];
                        const newStates = [...shot.characterStateIds];
                        newIds[i] = newAid;
                        newStates[i] = newSid;
                        updateShot(selectedIdx, 'characterAssetIds', newIds);
                        updateShot(selectedIdx, 'characterStateIds', newStates);
                      }
                    }}
                  >
                    <option value="">Character {i + 1}: None</option>
                    {projectAssets.characters.map((a) => (
                      <optgroup key={a.id} label={a.name}>
                        {a.states.map((st) => (
                          <option key={st.id} value={`${a.id}|${st.id}`}>{st.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ))}
                {shot.characterAssetIds.length < 4 && (
                  <button
                    onClick={() => {
                      updateShot(selectedIdx, 'characterAssetIds', [...shot.characterAssetIds, '']);
                      updateShot(selectedIdx, 'characterStateIds', [...shot.characterStateIds, '']);
                      updateShot(selectedIdx, 'characterAudioIds', [...shot.characterAudioIds, '']);
                      updateShot(selectedIdx, 'characterAudioTypes', [...shot.characterAudioTypes, 'voice']);
                    }}
                    className="text-xs text-accent hover:text-accent/80"
                  >
                    + Add Character
                  </button>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Audio Type</label>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      updateShot(selectedIdx, 'sceneDialogAudioId', null);
                      updateShot(selectedIdx, 'characterAudioIds', []);
                      updateShot(selectedIdx, 'characterAudioTypes', []);
                    }}
                    className={`px-2 py-1 rounded text-xs font-medium ${shot.sceneDialogAudioId === null && shot.characterAudioIds.length === 0 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    None
                  </button>
                  <button
                    onClick={() => {
                      updateShot(selectedIdx, 'characterAudioIds', []);
                      updateShot(selectedIdx, 'characterAudioTypes', []);
                      if (!shot.sceneDialogAudioId) updateShot(selectedIdx, 'sceneDialogAudioId', '');
                    }}
                    className={`px-2 py-1 rounded text-xs font-medium ${shot.sceneDialogAudioId !== null && shot.sceneDialogAudioId !== undefined ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    Scene Dialog
                  </button>
                  <button
                    onClick={() => {
                      updateShot(selectedIdx, 'sceneDialogAudioId', null);
                      if (shot.characterAudioIds.length === 0) {
                        updateShot(selectedIdx, 'characterAudioIds', ['']);
                        updateShot(selectedIdx, 'characterAudioTypes', ['voice']);
                      }
                    }}
                    className={`px-2 py-1 rounded text-xs font-medium ${!shot.sceneDialogAudioId && shot.characterAudioIds.length > 0 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    Voice Samples
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Audio</label>
                {shot.sceneDialogAudioId !== null && shot.sceneDialogAudioId !== undefined ? (
                  <select
                    className="w-full px-2 py-1 border border-border rounded text-sm bg-card text-foreground"
                    value={shot.sceneDialogAudioId}
                    onChange={(e) => updateShot(selectedIdx, 'sceneDialogAudioId', e.target.value || null)}
                  >
                    <option value="">None</option>
                    {audioAssets.filter((a) => a.audioType === 'SCENE_DIALOG').map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                ) : shot.characterAudioIds.length > 0 ? (
                  shot.characterAudioIds.map((aid, i) => (
                    <select
                      key={i}
                      className="w-full px-1 py-1 border border-border rounded text-xs bg-card text-foreground mb-1"
                      value={aid}
                      onChange={(e) => {
                        const newIds = [...shot.characterAudioIds];
                        newIds[i] = e.target.value;
                        updateShot(selectedIdx, 'characterAudioIds', newIds);
                      }}
                    >
                      <option value="">Char {i + 1}: None</option>
                      {audioAssets
                        .filter((a) => a.audioType === 'VOICE_SAMPLE')
                        .map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">None</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Props</label>
                {shot.propAssetIds.map((aid, i) => (
                  <select
                    key={i}
                    className="w-full px-2 py-1 border border-border rounded text-sm bg-card text-foreground mb-1"
                    value={shot.propStateIds[i] ? `${aid}|${shot.propStateIds[i]}` : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        const newIds = shot.propAssetIds.filter((_, j) => j !== i);
                        const newStates = shot.propStateIds.filter((_, j) => j !== i);
                        updateShot(selectedIdx, 'propAssetIds', newIds);
                        updateShot(selectedIdx, 'propStateIds', newStates);
                      } else {
                        const [newAid, newSid] = val.split('|');
                        const newIds = [...shot.propAssetIds];
                        const newStates = [...shot.propStateIds];
                        newIds[i] = newAid;
                        newStates[i] = newSid;
                        updateShot(selectedIdx, 'propAssetIds', newIds);
                        updateShot(selectedIdx, 'propStateIds', newStates);
                      }
                    }}
                  >
                    <option value="">Prop {i + 1}: None</option>
                    {projectAssets.props.map((a) => (
                      <optgroup key={a.id} label={a.name}>
                        {a.states.map((st) => (
                          <option key={st.id} value={`${a.id}|${st.id}`}>{st.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ))}
                {shot.propAssetIds.length < 4 && (
                  <button
                    onClick={() => {
                      updateShot(selectedIdx, 'propAssetIds', [...shot.propAssetIds, '']);
                      updateShot(selectedIdx, 'propStateIds', [...shot.propStateIds, '']);
                    }}
                    className="text-xs text-accent hover:text-accent/80"
                  >
                    + Add Prop
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Music</h4>
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateShot(selectedIdx, 'musicOn', !shot.musicOn)}
                className={`px-3 py-1 rounded text-xs font-medium ${shot.musicOn ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                {shot.musicOn ? 'On' : 'Off'}
              </button>
              {shot.musicOn && (
                <input
                  type="text"
                  className="flex-1 px-2 py-1 border border-border rounded text-sm bg-card text-foreground"
                  placeholder="Describe background music…"
                  value={shot.musicDesc}
                  onChange={(e) => updateShot(selectedIdx, 'musicDesc', e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="flex-1">
              {textField('Prompt', shot.prompt, (v) => updateShot(selectedIdx, 'prompt', v), 12)}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => generatePrompt(selectedIdx)}
                disabled={genPromptLoading}
                className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 whitespace-nowrap disabled:opacity-50"
              >
                {genPromptLoading ? 'Generating...' : 'Generate Prompt'}
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(shot.prompt)}
                disabled={!shot.prompt}
                className="px-6 py-2 bg-muted text-foreground rounded hover:bg-muted/80 whitespace-nowrap disabled:opacity-50"
              >
                Copy Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {shots.length === 0 && !isLoading && (
        <div className="p-4 border border-border rounded bg-muted text-muted-foreground text-sm text-center">
          No shots yet. Generate from the Script or paste JSON below.
        </div>
      )}

      {error && (
        <div className="p-4 border border-destructive/40 bg-destructive/10 rounded-lg text-destructive text-sm">{error}</div>
      )}

      {saved && (
        <div className="p-3 border border-success/40 bg-success/10 rounded-lg text-success text-sm">
          Shots saved successfully.
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-medium text-foreground">Raw JSON</h4>
          <button onClick={loadFromRaw} className="px-2 py-1 bg-accent-soft text-accent rounded text-xs hover:bg-accent/20">
            Load Shots
          </button>
        </div>
        <textarea
          className="w-full p-3 border border-border rounded bg-card text-foreground text-xs font-mono resize-y"
          rows={6}
          placeholder='Paste the full JSON response here, then click "Load Shots"...'
          value={rawShots}
          onChange={(e) => setRawShots(e.target.value)}
        />
      </div>

      <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-border">
        <button
          onClick={handleGenerateShots}
          disabled={isLoading || !currentProject?.script?.content}
          className="px-6 py-2 bg-accent text-accent-foreground rounded hover:bg-accent/80 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Generating...' : shots.length > 0 ? 'Regenerate Shots' : 'Generate Shots'}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || shots.length === 0}
          className="px-6 py-2 bg-success text-white rounded hover:bg-success/80 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Shots'}
        </button>
      </div>
    </div>
  );
};

export default ShotListStage;
