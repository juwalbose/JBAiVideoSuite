import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';

type AssetItem = {
  id: string;
  name: string;
  description: string;
  states?: { id: string; name: string; description: string; prompt: string; scenes: string; imagePath: string; characterSheet: string }[];
  scenes?: string;
};

const AssetsStage = () => {
  const { currentProject } = useProjectStore();
  const { backend } = useSettingsStore();
  const baseUrl = backend?.apiUrl || 'http://127.0.0.1:8000';
  const [assets, setAssets] = useState<{ characters: AssetItem[]; locations: AssetItem[]; props: AssetItem[] }>({ characters: [], locations: [], props: [] });
  const [activeTab, setActiveTab] = useState<'characters' | 'locations' | 'props'>('characters');
  const [selected, setSelected] = useState<{ type: string; index: number; stateIndex: number } | null>(null);
  const [editing, setEditing] = useState<AssetItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState('');
  const [addExisting, setAddExisting] = useState('');
  const [addAssetName, setAddAssetName] = useState('');
  const [addAssetDesc, setAddAssetDesc] = useState('');
  const [addStateName, setAddStateName] = useState('');
  const [addStateDesc, setAddStateDesc] = useState('');
  const [adding, setAdding] = useState(false);

  const refreshAssets = async () => {
    if (!currentProject) return;
    const res = await fetch(`${baseUrl}/projects/${currentProject.id}/assets`);
    const data = await res.json();
    if (data.status === 'success') setAssets(data.assets);
  };

  useEffect(() => {
    if (!currentProject) return;
    fetch(`${baseUrl}/projects/${currentProject.id}/assets`)
      .then(r => r.json())
      .then(data => { if (data.status === 'success') setAssets(data.assets); })
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
      setEditing({ name: asset.name, description: asset.description, states: [{ ...s }] });
    } else {
      setEditing({ name: asset.name, description: asset.description, scenes: asset.scenes });
    }
  };

  const getAssetId = () => {
    if (!selected) return '';
    return (assets[selected.type as keyof typeof assets] || [])[selected.index]?.id || '';
  };

  const getStateId = () => {
    if (!selected || !editing?.states?.[0]) return '';
    return editing.states[0].id || '';
  };

  const handleSave = async () => {
    if (!selected || !editing) return;
    setSaving(true); setError('');
    try {
      const list = assets[selected.type as keyof typeof assets];
      const asset = list[selected.index];
      const body: Record<string, any> = { name: editing.name, description: editing.description };
      if (editing.states && asset.states?.length) {
        body.states = asset.states.map((st, i) => i === selected.stateIndex ? editing.states![0] : st);
      }
      const res = await fetch(`${baseUrl}/projects/${currentProject!.id}/assets/${getAssetId()}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.status === 'error') throw new Error(data.details || 'Save failed');
      await refreshAssets();
    } catch { setError('Failed to save asset'); } finally { setSaving(false); }
  };

  const handleGeneratePrompt = async () => {
    if (!selected || !editing) return;
    setGenerating(true); setError('');
    try {
      const state = editing.states?.[0];
      const res = await fetch(`${baseUrl}/projects/${currentProject!.id}/assets/${getAssetId()}/generate-prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetDescription: editing.description, stateName: state?.name, stateDescription: state?.description }) });
      const data = await res.json();
      if (data.status === 'error') { setError(data.details); return; }
      const st = [...editing.states!];
      st[0] = { ...st[0], prompt: data.prompt };
      setEditing({ ...editing, states: st });
    } catch { setError('Failed to generate prompt'); } finally { setGenerating(false); }
  };

  const handleDelete = async () => {
    if (!selected || !editing) return;
    const stateId = getStateId();
    const assetId = getAssetId();
    try {
      if (stateId) {
        await fetch(`${baseUrl}/projects/${currentProject!.id}/assets/${assetId}/states/${stateId}`, { method: 'DELETE' });
      } else {
        await fetch(`${baseUrl}/projects/${currentProject!.id}/assets/${assetId}`, { method: 'DELETE' });
      }
      setSelected(null); setEditing(null);
      await refreshAssets();
    } catch { setError('Failed to delete'); }
  };

  const handleAdd = async () => {
    setAdding(true); setError('');
    try {
      const body: Record<string, any> = { type: addType, stateName: addStateName, stateDescription: addStateDesc };
      if (addExisting) body.existingAssetId = addExisting;
      else { body.assetName = addAssetName; body.assetDescription = addAssetDesc; }
      const res = await fetch(`${baseUrl}/projects/${currentProject!.id}/assets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.status === 'error') throw new Error(data.details);
      setShowAddModal(false);
      setAddType(''); setAddExisting(''); setAddAssetName(''); setAddAssetDesc(''); setAddStateName(''); setAddStateDesc('');
      await refreshAssets();
    } catch (e: any) { setError(e.message || 'Failed to add'); } finally { setAdding(false); }
  };

  const items = getItems();
  const existingAssets = assets[addType as keyof typeof assets] || [];

  return (
    <div className="flex gap-4 h-full">
      {/* Left: asset list */}
      <div className="w-64 border rounded-lg overflow-y-auto h-full flex flex-col">
        <div className="flex border-b">
          {(['characters', 'locations', 'props'] as const).map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setSelected(null); setEditing(null); }}
              className={`flex-1 py-2 text-xs font-medium ${activeTab === t ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="p-2 space-y-1 flex-1 overflow-y-auto">
          {items.length === 0 && <p className="text-xs text-gray-400 p-2">No assets yet</p>}
          {items.map((item, i) => (
            <button key={i} onClick={() => handleSelect(item)}
              className={`w-full text-left p-2 rounded text-xs hover:bg-gray-100 ${selected?.index === item.index && selected?.stateIndex === item.stateIndex ? 'bg-blue-50 border border-blue-200' : ''}`}>
              <span className="font-medium">{item.label}</span>
              <p className="text-gray-500 truncate">{item.desc}</p>
            </button>
          ))}
        </div>
        <div className="p-2 border-t">
          <button onClick={() => setShowAddModal(true)} className="w-full py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
            + Add Asset / State
          </button>
        </div>
      </div>

      {/* Right: detail preview */}
      <div className="flex-1 border rounded-lg p-4 overflow-y-auto h-full">
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
            {editing.states?.map((s) => (
              <div key="state" className="border rounded p-3 bg-gray-50 space-y-1">
                <label className="text-sm font-medium text-gray-700">State</label>
                <input className="w-full p-2 border rounded text-sm" value={s.name} placeholder="State name" onChange={e => { const st = [...editing.states!]; st[0] = { ...st[0], name: e.target.value }; setEditing({ ...editing, states: st }); }} />
                <div className="flex gap-2">
                  <div className="flex-1 border rounded bg-white p-2">
                    <p className="text-xs text-gray-500 mb-1">Image</p>
                    {s.imagePath ? (
                      <img src={`${baseUrl}${s.imagePath}`} alt={s.name} className="w-full h-32 object-cover rounded" />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-400">No image</div>
                    )}
                  </div>
                  <div className="flex-1 border rounded bg-white p-2">
                    <p className="text-xs text-gray-500 mb-1">Character Sheet</p>
                    {s.characterSheet ? (
                      <img src={`${baseUrl}${s.characterSheet}`} alt={`${s.name} sheet`} className="w-full h-32 object-cover rounded" />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-400">No sheet</div>
                    )}
                  </div>
                </div>
                <textarea className="w-full p-2 border rounded text-sm" rows={2} value={s.description} placeholder="Description" onChange={e => { const st = [...editing.states!]; st[0] = { ...st[0], description: e.target.value }; setEditing({ ...editing, states: st }); }} />
                <textarea className="w-full p-2 border rounded text-sm" rows={6} value={s.prompt || ''} placeholder="Prompt" onChange={e => { const st = [...editing.states!]; st[0] = { ...st[0], prompt: e.target.value }; setEditing({ ...editing, states: st }); }} />
                <div className="flex gap-2">
                  <button onClick={() => handleGeneratePrompt()} disabled={generating} className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50">
                    {generating ? 'Generating...' : 'Generate Prompt'}
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(s.prompt || '')} className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700">
                    Copy Prompt
                  </button>
                </div>
                <input className="w-full p-2 border rounded text-sm" placeholder="Scenes (comma-separated)" value={s.scenes || ''} onChange={e => { const st = [...editing.states!]; st[0] = { ...st[0], scenes: e.target.value }; setEditing({ ...editing, states: st }); }} />
              </div>
            ))}
            {editing.scenes !== undefined && (
              <div>
                <label className="text-sm font-medium text-gray-700">Scenes</label>
                <input className="w-full p-2 border rounded mt-1" value={editing.scenes || ''} onChange={e => setEditing({ ...editing, scenes: e.target.value })} />
              </div>
            )}
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-gray-800 text-white rounded hover:bg-black disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Asset'}
              </button>
              <button onClick={handleDelete} className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-400 italic">Select an asset to view details</p>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-slate-800">Add Asset / State</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Type</label>
                <select value={addType} onChange={e => { setAddType(e.target.value); setAddExisting(''); }} className="w-full p-2 border rounded mt-1 text-sm">
                  <option value="">Select type</option>
                  <option value="CHARACTER">Character</option>
                  <option value="LOCATION">Location</option>
                  <option value="PROP">Prop</option>
                </select>
              </div>
              {addType && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Existing Asset (optional)</label>
                  <select value={addExisting} onChange={e => setAddExisting(e.target.value)} className="w-full p-2 border rounded mt-1 text-sm">
                    <option value="">New Asset</option>
                    {existingAssets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              {!addExisting && (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Asset Name</label>
                    <input className="w-full p-2 border rounded mt-1 text-sm" value={addAssetName} onChange={e => setAddAssetName(e.target.value)} placeholder="Asset name" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Asset Description</label>
                    <textarea className="w-full p-2 border rounded mt-1 text-sm" rows={2} value={addAssetDesc} onChange={e => setAddAssetDesc(e.target.value)} placeholder="Description" />
                  </div>
                </>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700">State Name</label>
                <input className="w-full p-2 border rounded mt-1 text-sm" value={addStateName} onChange={e => setAddStateName(e.target.value)} placeholder="State name" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">State Description</label>
                <textarea className="w-full p-2 border rounded mt-1 text-sm" rows={2} value={addStateDesc} onChange={e => setAddStateDesc(e.target.value)} placeholder="State description" />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button onClick={handleAdd} disabled={adding || !addType || !addStateName || !addStateDesc || (!addExisting && !addAssetName)}
                className="w-full py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetsStage;
