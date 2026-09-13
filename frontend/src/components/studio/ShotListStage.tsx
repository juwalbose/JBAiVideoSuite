import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';

interface ShotData {
  shot: number;
  frames: number;
  duration: number;
  camera: string;
  action: string;
  dialogue: string;
  note: string;
  prompt: string;
}

const ShotListStage = ({ selectedEpisode }: { selectedEpisode: number }) => {
  const { currentProject } = useProjectStore();
  const [shots, setShots] = useState<ShotData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [rawShots, setRawShots] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentProject) return;
    const baseUrl = useSettingsStore.getState().backend.apiUrl;
    fetch(`${baseUrl}/projects/${currentProject.id}/shotlist`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setShots(data.map(mapShot));
          setSelectedIdx(0);
        }
      })
      .catch(console.error);
  }, [currentProject?.id]);

  const mapShot = (s: any): ShotData => ({
    shot: Number(s.shot) || 0,
    frames: Number(s.frames) || 0,
    duration: Number(s.duration) || 0,
    camera: s.camera || '',
    action: s.action || '',
    dialogue: s.dialogue || '',
    note: s.note || '',
    prompt: s.prompt || '',
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
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/generate-shots`, {
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
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/shotlist`, {
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

  const updateShot = (index: number, field: keyof ShotData, value: string | number) => {
    setShots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    setSaved(false);
  };

  const deleteShot = (index: number) => {
    setShots((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setSelectedIdx((si) => (si >= next.length ? Math.max(0, next.length - 1) : si));
      return next;
    });
    setSaved(false);
  };

  const addShot = () => {
    const nextNum = shots.length > 0 ? Math.max(...shots.map((s) => s.shot)) + 1 : 1;
    setShots((prev) => [...prev, { shot: nextNum, frames: 0, duration: 0, camera: '', action: '', dialogue: '', note: '', prompt: '' }]);
    setSelectedIdx(shots.length);
    setSaved(false);
  };

  const shot = shots[selectedIdx];

  const numField = (label: string, value: number, onChange: (v: number) => void) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input type="number" className="w-full px-2 py-1 border rounded text-sm bg-white text-black"
        value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );

  const textField = (label: string, value: string, onChange: (v: string) => void, rows = 3) => (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <textarea className="w-full px-2 py-1 border rounded text-sm bg-white text-black resize-y"
        rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  return (
    <div className="space-y-4">
      {currentProject?.type === 'episodic' && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Episode:</label>
          <span className="text-sm text-gray-500">Episode {selectedEpisode}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-blue-900">Shot List ({shots.length} shots)</h3>
        <button onClick={addShot} className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
          + Add Shot
        </button>
      </div>

      {shots.length > 0 && shot && (
        <div className="p-4 border rounded-lg bg-white shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <select
              className="px-3 py-1 border rounded text-sm bg-white text-black"
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
            >
              {shots.map((s, i) => (
                <option key={i} value={i}>Shot {s.shot}</option>
              ))}
            </select>
            <button onClick={() => deleteShot(selectedIdx)} className="text-red-500 hover:text-red-700 text-xs underline">
              Delete Shot
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {numField('Shot #', shot.shot, (v) => updateShot(selectedIdx, 'shot', v))}
            {numField('Frames', shot.frames, (v) => updateShot(selectedIdx, 'frames', v))}
            {numField('Duration (s)', shot.duration, (v) => updateShot(selectedIdx, 'duration', v))}
          </div>
          {textField('Camera', shot.camera, (v) => updateShot(selectedIdx, 'camera', v))}
          {textField('Action', shot.action, (v) => updateShot(selectedIdx, 'action', v))}
          {textField('Dialogue', shot.dialogue, (v) => updateShot(selectedIdx, 'dialogue', v))}
          {textField('Note', shot.note, (v) => updateShot(selectedIdx, 'note', v))}
          {textField('Prompt', shot.prompt, (v) => updateShot(selectedIdx, 'prompt', v), 4)}
        </div>
      )}

      {shots.length === 0 && !isLoading && (
        <div className="p-4 border rounded bg-gray-50 text-gray-500 text-sm text-center">
          No shots yet. Generate from the Script or paste JSON below.
        </div>
      )}

      {error && (
        <div className="p-4 border border-red-300 bg-red-50 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {saved && (
        <div className="p-3 border border-green-300 bg-green-50 rounded-lg text-green-700 text-sm">
          Shots saved successfully.
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-medium text-gray-700">Raw JSON</h4>
          <button onClick={loadFromRaw} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
            Load Shots
          </button>
        </div>
        <textarea
          className="w-full p-3 border rounded bg-gray-50 text-black text-xs font-mono resize-y"
          rows={6}
          placeholder='Paste the full JSON response here, then click "Load Shots"...'
          value={rawShots}
          onChange={(e) => setRawShots(e.target.value)}
        />
      </div>

      <div className="flex justify-center gap-4 mt-4 pt-4 border-t">
        <button
          onClick={handleGenerateShots}
          disabled={isLoading || !currentProject?.script?.content}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Generating...' : shots.length > 0 ? 'Regenerate Shots' : 'Generate Shots'}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || shots.length === 0}
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Shots'}
        </button>
      </div>
    </div>
  );
};

export default ShotListStage;
