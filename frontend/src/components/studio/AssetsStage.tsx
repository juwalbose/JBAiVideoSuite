import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';

type AssetItem = {
  name: string;
  description: string;
  states?: { name: string; description: string; prompt: string; scenes: string; imagePath: string; characterSheet: string }[];
  scenes?: string;
};

const AssetsStage = () => {
  const { currentProject } = useProjectStore();
  const [assets, setAssets] = useState<{ characters: AssetItem[]; locations: AssetItem[]; props: AssetItem[] }>({ characters: [], locations: [], props: [] });
  const [activeTab, setActiveTab] = useState<'characters' | 'locations' | 'props'>('characters');
  const [selected, setSelected] = useState<{ type: string; index: number; stateIndex: number } | null>(null);
  const [editing, setEditing] = useState<AssetItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentProject) return;
    const baseUrl = useSettingsStore.getState().backend.apiUrl;
    fetch(`${baseUrl}/projects/${currentProject.id}/assets`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') setAssets(data.assets);
      })
      .catch(err => setError('Failed to load assets'));
  }, [currentProject?.id]);

  const getItems = () => {
    const list = assets[activeTab] || [];
    const items: { label: string; desc: string; type: string; index: number; stateIndex: number }[] = [];
    list.forEach((a, i) => {
      if (a.states?.length) {
        a.states.forEach((s, si) => {
          items.push({ label: `${a.name} — ${s.name}`, desc: s.description, type: activeTab, index: i, stateIndex: si });
        });
      } else {
        items.push({ label: a.name, desc: a.description, type: activeTab, index: i, stateIndex: -1 });
      }
    });
    return items;
  };

  const handleSelect = (item: { type: string; index: number; stateIndex: number }) => {
    setSelected(item);
    const list = assets[item.type as keyof typeof assets];
    const asset = list[item.index];
    if (asset.states?.length && item.stateIndex >= 0) {
      const s = asset.states[item.stateIndex];
      setEditing({ name: asset.name, description: asset.description, states: asset.states.map((st, i) => i === item.stateIndex ? { ...st } : { ...st }) });
    } else {
      setEditing({ name: asset.name, description: asset.description, scenes: asset.scenes });
    }
  };

  const getAssetId = () => {
    if (!selected) return '';
    return (assets[selected.type as keyof typeof assets] || [])[selected.index]?.id || '';
  };

  const handleSave = async () => {
    if (!selected || !editing) return;
    setSaving(true); setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const body: Record<string, any> = { name: editing.name, description: editing.description };
      if (editing.states) body.states = editing.states;
      const res = await fetch(`${baseUrl}/projects/${currentProject!.id}/assets/${getAssetId()}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Save failed');
      const refresh = await fetch(`${baseUrl}/projects/${currentProject!.id}/assets`).then(r => r.json());
      if (refresh.status === 'success') setAssets(refresh.assets);
    } catch { setError('Failed to save asset'); } finally { setSaving(false); }
  };

  const handleGeneratePrompt = async (stateIndex: number) => {
    if (!selected || !editing) return;
    setGenerating(true); setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const state = editing.states?.[stateIndex];
      const res = await fetch(`${baseUrl}/projects/${currentProject!.id}/assets/${getAssetId()}/generate-prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stateName: state?.name, description: state?.description }) });
      const data = await res.json();
      if (data.status === 'error') { setError(data.details); return; }
      const st = [...editing.states!];
      st[stateIndex] = { ...st[stateIndex], prompt: data.prompt };
      setEditing({ ...editing, states: st });
    } catch { setError('Failed to generate prompt'); } finally { setGenerating(false); }
  };

  const items = getItems();

  return (
    <div className="flex gap-4 h-full">
      {/* Left: asset list */}
      <div className="w-64 border rounded-lg overflow-y-auto max-h-[600px]">
        <div className="flex border-b">
          {(['characters', 'locations', 'props'] as const).map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setSelected(null); setEditing(null); }}
              className={`flex-1 py-2 text-xs font-medium ${activeTab === t ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="p-2 space-y-1">
          {items.length === 0 && <p className="text-xs text-gray-400 p-2">No assets yet</p>}
          {items.map((item, i) => (
            <button key={i} onClick={() => handleSelect(item)}
              className={`w-full text-left p-2 rounded text-xs hover:bg-gray-100 ${selected?.index === item.index && selected?.stateIndex === item.stateIndex ? 'bg-blue-50 border border-blue-200' : ''}`}>
              <span className="font-medium">{item.label}</span>
              <p className="text-gray-500 truncate">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail preview */}
      <div className="flex-1 border rounded-lg p-4 overflow-y-auto max-h-[600px]">
        {editing ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-900">Asset Details</h3>
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <input className="w-full p-2 border rounded mt-1" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <textarea className="w-full p-2 border rounded mt-1" rows={3} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </div>
            {editing.states?.map((s, i) => (
              <div key={i} className="border rounded p-3 bg-gray-50 space-y-1">
                <label className="text-sm font-medium text-gray-700">State {i + 1}</label>
                <input className="w-full p-2 border rounded text-sm" value={s.name} placeholder="State name" onChange={e => { const st = [...editing.states!]; st[i] = { ...st[i], name: e.target.value }; setEditing({ ...editing, states: st }); }} />
                <div className="flex gap-2">
                  <div className="flex-1 border rounded bg-white p-2">
                    <p className="text-xs text-gray-500 mb-1">Image</p>
                    {s.imagePath ? (
                      <img src={s.imagePath} alt={s.name} className="w-full h-32 object-cover rounded" />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-400">No image</div>
                    )}
                  </div>
                  <div className="flex-1 border rounded bg-white p-2">
                    <p className="text-xs text-gray-500 mb-1">Character Sheet</p>
                    {s.characterSheet ? (
                      <img src={s.characterSheet} alt={`${s.name} sheet`} className="w-full h-32 object-cover rounded" />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-400">No sheet</div>
                    )}
                  </div>
                </div>
                <textarea className="w-full p-2 border rounded text-sm" rows={2} value={s.description} placeholder="Description" onChange={e => { const st = [...editing.states!]; st[i] = { ...st[i], description: e.target.value }; setEditing({ ...editing, states: st }); }} />
                <textarea className="w-full p-2 border rounded text-sm" rows={6} value={s.prompt || ''} placeholder="Prompt" onChange={e => { const st = [...editing.states!]; st[i] = { ...st[i], prompt: e.target.value }; setEditing({ ...editing, states: st }); }} />
                <button onClick={() => handleGeneratePrompt(i)} disabled={generating} className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50">
                  {generating ? 'Generating...' : 'Generate Prompt'}
                </button>
                <input className="w-full p-2 border rounded text-sm" placeholder="Scenes (comma-separated)" value={s.scenes || ''} onChange={e => { const st = [...editing.states!]; st[i] = { ...st[i], scenes: e.target.value }; setEditing({ ...editing, states: st }); }} />
              </div>
            ))}
            {editing.scenes !== undefined && (
              <div>
                <label className="text-sm font-medium text-gray-700">Scenes</label>
                <input className="w-full p-2 border rounded mt-1" value={editing.scenes || ''} onChange={e => setEditing({ ...editing, scenes: e.target.value })} />
              </div>
            )}
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 bg-gray-800 text-white rounded hover:bg-black disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Asset'}
            </button>
          </div>
        ) : (
          <p className="text-gray-400 italic">Select an asset to view details</p>
        )}
      </div>
    </div>
  );
};

export default AssetsStage;
