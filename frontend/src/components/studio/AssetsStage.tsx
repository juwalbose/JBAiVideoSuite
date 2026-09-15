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

type AudioItem = {
  id: string;
  name: string;
  audioPath: string;
  audioType: string;
  transcript: string;
};

const AssetsStage = ({ selectedEpisode }: { selectedEpisode: number }) => {
  const { currentProject } = useProjectStore();
  const { backend } = useSettingsStore();
  const baseUrl = backend?.apiUrl || 'http://127.0.0.1:8000';
  const [assets, setAssets] = useState<{ characters: AssetItem[]; locations: AssetItem[]; props: AssetItem[] }>({ characters: [], locations: [], props: [] });
  const [audioList, setAudioList] = useState<AudioItem[]>([]);
  const [activeTab, setActiveTab] = useState<'characters' | 'locations' | 'props' | 'audio'>('characters');
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
  const [genAll, setGenAll] = useState<{ active: boolean; current: number; total: number; done: number; failed: number } | null>(null);
  const [genImage, setGenImage] = useState(false);
  const [genSheet, setGenSheet] = useState(false);
  const abortRef = React.useRef(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioName, setAudioName] = useState('');
  const [audioType, setAudioType] = useState('VOICE_SAMPLE');
  const [audioTranscript, setAudioTranscript] = useState('');
  const [audioImporting, setAudioImporting] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<AudioItem | null>(null);

  const refreshAssets = async () => {
    if (!currentProject) return;
    const res = await fetch(`${baseUrl}/projects/${currentProject.id}/assets?episode=${selectedEpisode}`);
    const data = await res.json();
    if (data.status === 'success') setAssets(data.assets);
  };

  useEffect(() => {
    if (!currentProject) return;
    fetch(`${baseUrl}/projects/${currentProject.id}/assets?episode=${selectedEpisode}`)
      .then(r => r.json())
      .then(data => { if (data.status === 'success') setAssets(data.assets); })
      .catch(err => setError('Failed to load assets'));
    fetch(`${baseUrl}/projects/${currentProject.id}/audio?episode=${selectedEpisode}`)
      .then(r => r.json())
      .then(data => { if (data.status === 'success') setAudioList(data.audio); })
      .catch(console.error);
  }, [currentProject?.id, selectedEpisode]);

  useEffect(() => {
    const list = assets[activeTab] || [];
    if (list.length === 0) { setSelected(null); setEditing(null); return; }
    const first = list[0];
    const item = first.states?.length
      ? { type: activeTab, index: 0, stateIndex: 0 }
      : { type: activeTab, index: 0, stateIndex: -1 };
    setSelected(item);
    if (first.states?.length) {
      setEditing({ id: first.id, name: first.name, description: first.description, states: [{ ...first.states[0] }] });
    } else {
      setEditing({ id: first.id, name: first.name, description: first.description, scenes: first.scenes });
    }
  }, [assets, activeTab]);

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
      setEditing({ id: asset.id, name: asset.name, description: asset.description, states: [{ ...s }] });
    } else {
      setEditing({ id: asset.id, name: asset.name, description: asset.description, scenes: asset.scenes });
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
      const res = await fetch(`${baseUrl}/projects/${currentProject!.id}/assets/${getAssetId()}?episode=${selectedEpisode}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
      const res = await fetch(`${baseUrl}/projects/${currentProject!.id}/assets/${getAssetId()}/generate-prompt?episode=${selectedEpisode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetDescription: editing.description, stateName: state?.name, stateDescription: state?.description }) });
      const data = await res.json();
      if (data.status === 'error') { setError(data.details); return; }
      const st = [...editing.states!];
      st[0] = { ...st[0], prompt: data.prompt };
      setEditing({ ...editing, states: st });
    } catch { setError('Failed to generate prompt'); } finally { setGenerating(false); }
  };

  const handleGenerateAll = async () => {
    if (!currentProject) return;
    abortRef.current = false;
    const allStates: { type: string; assetIndex: number; stateIndex: number; assetId: string; assetDesc: string; stateName: string; stateDesc: string }[] = [];
    (['characters', 'locations', 'props'] as const).forEach(tab => {
      (assets[tab] || []).forEach((a, ai) => {
        (a.states || []).forEach((s, si) => {
          allStates.push({ type: tab, assetIndex: ai, stateIndex: si, assetId: a.id, assetDesc: a.description, stateName: s.name, stateDesc: s.description });
        });
      });
    });
    if (allStates.length === 0) { setError('No states to generate'); return; }
    setGenAll({ active: true, current: 0, total: allStates.length, done: 0, failed: 0 });
    let done = 0, failed = 0;
    let i = 0;
    for (; i < allStates.length; i++) {
      if (abortRef.current) break;
      const item = allStates[i];
      setGenAll({ active: true, current: i + 1, total: allStates.length, done, failed });
      try {
        const res = await fetch(`${baseUrl}/projects/${currentProject.id}/assets/${item.assetId}/generate-prompt?episode=${selectedEpisode}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetDescription: item.assetDesc, stateName: item.stateName, stateDescription: item.stateDesc }),
        });
        const data = await res.json();
        if (data.status === 'error') throw new Error(data.details);
        // PATCH to persist immediately
        const list = assets[item.type as keyof typeof assets];
        const asset = list[item.assetIndex];
        const states = (asset.states || []).map((st, si) => si === item.stateIndex ? { ...st, prompt: data.prompt } : st);
        await fetch(`${baseUrl}/projects/${currentProject.id}/assets/${item.assetId}?episode=${selectedEpisode}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: asset.name, description: asset.description, states }),
        });
        done++;
      } catch { failed++; }
      setGenAll({ active: true, current: i + 1, total: allStates.length, done, failed });
    }
    if (abortRef.current) {
      setGenAll({ active: false, current: i, total: allStates.length, done, failed });
    } else {
      setGenAll(null);
    }
    await refreshAssets();
  };

  const handleGenerateImage = async () => {
    if (!selected || !editing?.states?.[0] || !currentProject) return;
    setGenImage(true); setError('');
    try {
      const assetId = getAssetId();
      const stateId = getStateId();
      const res = await fetch(`${baseUrl}/projects/${currentProject.id}/assets/${assetId}/generate-image`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stateId }),
      });
      const data = await res.json();
      if (data.status === 'error') { setError(data.details); setGenImage(false); return; }
      const taskId = data.task_id;
      // Poll for completion
      const poll = async () => {
        try {
          const sRes = await fetch(`${baseUrl}/projects/${currentProject.id}/assets/${assetId}/generate-image/status/${taskId}`);
          const sData = await sRes.json();
          if (sData.status === 'complete') {
            setGenImage(false);
            await refreshAssets();
          } else if (sData.status === 'pending') {
            setTimeout(poll, 3000);
          } else {
            setError(sData.details || 'Generation failed');
            setGenImage(false);
          }
        } catch {
          setError('Polling failed');
          setGenImage(false);
        }
      };
      setTimeout(poll, 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to generate image');
      setGenImage(false);
    }
  };

  const handleGenerateSheet = async () => {
    if (!selected || !editing?.states?.[0] || !currentProject) return;
    if (!editing.states[0].imagePath) { setError('Assign an image first'); return; }
    setGenSheet(true); setError('');
    try {
      const assetId = getAssetId();
      const stateId = getStateId();
      const res = await fetch(`${baseUrl}/projects/${currentProject.id}/assets/${assetId}/generate-sheet`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stateId }),
      });
      const data = await res.json();
      if (data.status === 'error') { setError(data.details); setGenSheet(false); return; }
      const taskId = data.task_id;
      const poll = async () => {
        try {
          const sRes = await fetch(`${baseUrl}/projects/${currentProject.id}/assets/${assetId}/generate-image/status/${taskId}`);
          const sData = await sRes.json();
          if (sData.status === 'complete') {
            setGenSheet(false);
            await refreshAssets();
          } else if (sData.status === 'pending') {
            setTimeout(poll, 3000);
          } else {
            setError(sData.details || 'Sheet generation failed');
            setGenSheet(false);
          }
        } catch {
          setError('Polling failed');
          setGenSheet(false);
        }
      };
      setTimeout(poll, 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to generate sheet');
      setGenSheet(false);
    }
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
      let type = addType;
      if (addExisting && !addType) {
        for (const t of ['characters', 'locations', 'props'] as const) {
          const found = (assets[t] || []).find(a => a.id === addExisting);
          if (found) { type = t === 'characters' ? 'CHARACTER' : t === 'locations' ? 'LOCATION' : 'PROP'; break; }
        }
      }
      const body: Record<string, any> = { type, stateName: addStateName, stateDescription: addStateDesc };
      if (addExisting) body.existingAssetId = addExisting;
      else { body.assetName = addAssetName; body.assetDescription = addAssetDesc; }
      const res = await fetch(`${baseUrl}/projects/${currentProject!.id}/assets?episode=${selectedEpisode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.status === 'error') throw new Error(data.details);
      setShowAddModal(false);
      setAddType(''); setAddExisting(''); setAddAssetName(''); setAddAssetDesc(''); setAddStateName(''); setAddStateDesc('');
      await refreshAssets();
    } catch (e: any) { setError(e.message || 'Failed to add'); } finally { setAdding(false); }
  };

  const handleImportAudio = async () => {
    if (!currentProject || !audioFile) return;
    setAudioImporting(true); setError('');
    try {
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('name', audioName);
      formData.append('audio_type', audioType);
      formData.append('transcript', audioTranscript);
      const res = await fetch(`${baseUrl}/projects/${currentProject.id}/audio?episode=${selectedEpisode}`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'error') throw new Error(data.details);
      setShowAudioModal(false);
      setAudioFile(null); setAudioName(''); setAudioType('VOICE_SAMPLE'); setAudioTranscript('');
      const audioRes = await fetch(`${baseUrl}/projects/${currentProject.id}/audio`);
      const audioData = await audioRes.json();
      if (audioData.status === 'success') setAudioList(audioData.audio);
    } catch (e: any) { setError(e.message || 'Failed to import audio'); } finally { setAudioImporting(false); }
  };

  const handleDeleteAudio = async (audioId: string) => {
    if (!currentProject) return;
    try {
      await fetch(`${baseUrl}/projects/${currentProject.id}/audio/${audioId}`, { method: 'DELETE' });
      setSelectedAudio(null);
      const res = await fetch(`${baseUrl}/projects/${currentProject.id}/audio`);
      const data = await res.json();
      if (data.status === 'success') setAudioList(data.audio);
    } catch { setError('Failed to delete audio'); }
  };

  const handleSaveAudio = async () => {
    if (!currentProject || !selectedAudio) return;
    try {
      await fetch(`${baseUrl}/projects/${currentProject.id}/audio/${selectedAudio.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedAudio.name, audioType: selectedAudio.audioType, transcript: selectedAudio.transcript }),
      });
      const res = await fetch(`${baseUrl}/projects/${currentProject.id}/audio`);
      const data = await res.json();
      if (data.status === 'success') setAudioList(data.audio);
    } catch { setError('Failed to save audio'); }
  };

  const items = getItems();

  return (
    <div className="flex gap-4 h-full">
      {/* Left: asset list */}
      <div className="w-64 border rounded-lg overflow-y-auto h-full flex flex-col">
        <div className="flex border-b">
          {(['characters', 'locations', 'props', 'audio'] as const).map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setSelected(null); setEditing(null); setSelectedAudio(null); }}
              className={`flex-1 py-2 text-xs font-medium ${activeTab === t ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="p-2 space-y-1 flex-1 overflow-y-auto">
          {activeTab === 'audio' ? (
            <>
              {audioList.length === 0 && <p className="text-xs text-gray-400 p-2">No audio assets yet</p>}
              {audioList.map((a) => (
                <button key={a.id} onClick={() => setSelectedAudio(a)}
                  className={`w-full text-left p-2 rounded text-xs hover:bg-gray-100 ${selectedAudio?.id === a.id ? 'bg-blue-50 border border-blue-200' : ''}`}>
                  <span className="font-medium">{a.name}</span>
                  <p className="text-gray-500 truncate">{a.audioType.replace('_', ' ')}</p>
                </button>
              ))}
            </>
          ) : (
            <>
              {items.length === 0 && <p className="text-xs text-gray-400 p-2">No assets yet</p>}
              {items.map((item, i) => (
                <button key={i} onClick={() => handleSelect(item)}
                  className={`w-full text-left p-2 rounded text-xs hover:bg-gray-100 ${selected?.index === item.index && selected?.stateIndex === item.stateIndex ? 'bg-blue-50 border border-blue-200' : ''}`}>
                  <span className="font-medium">{item.label}</span>
                  <p className="text-gray-500 truncate">{item.desc}</p>
                </button>
              ))}
            </>
          )}
        </div>
        <div className="p-2 border-t space-y-1">
          {activeTab === 'audio' ? (
            <button onClick={() => setShowAudioModal(true)} className="w-full py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
              + Import Audio
            </button>
          ) : (
            <>
              <button onClick={() => setShowAddModal(true)} className="w-full py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                + Add Asset / State
              </button>
              <button onClick={handleGenerateAll} disabled={genAll?.active}
                className="w-full py-2 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50">
                {genAll?.active ? `Generating ${genAll.current}/${genAll.total}...` : '⚡ Generate All Prompts'}
              </button>
              {genAll?.active && (
                <button onClick={() => { abortRef.current = true; }} className="w-full py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                  Stop
                </button>
              )}
              {genAll && !genAll.active && (genAll.done > 0 || genAll.failed > 0) && (
                <p className="text-xs text-gray-500 text-center">{genAll.done} done, {genAll.failed} failed</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: detail preview */}
      <div className="flex-1 border rounded-lg p-4 overflow-y-auto h-full">
        {activeTab === 'audio' ? (
          selectedAudio ? (
            <div className="space-y-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500">Name</label>
                  <input className="w-full p-2 border rounded text-sm font-semibold" value={selectedAudio.name} onChange={e => setSelectedAudio({ ...selectedAudio, name: e.target.value })} />
                </div>
                <div className="w-40">
                  <label className="text-xs font-medium text-gray-500">Type</label>
                  <select className="w-full p-2 border rounded text-sm" value={selectedAudio.audioType} onChange={e => setSelectedAudio({ ...selectedAudio, audioType: e.target.value })}>
                    <option value="VOICE_SAMPLE">Voice Sample</option>
                    <option value="CHARACTER_DIALOG">Character Dialog</option>
                    <option value="SCENE_DIALOG">Scene Dialog</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Audio File</label>
                <div className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-600">{selectedAudio.audioPath}</div>
                <audio controls src={`${baseUrl}${selectedAudio.audioPath}`} className="w-full mt-2" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Transcript</label>
                <textarea className="w-full p-2 border rounded mt-1 text-sm" rows={4} value={selectedAudio.transcript} onChange={e => setSelectedAudio({ ...selectedAudio, transcript: e.target.value })} placeholder="Transcription of the audio..." />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveAudio} className="flex-1 py-2 bg-gray-800 text-white text-xs rounded hover:bg-black">Save Audio</button>
                <button onClick={() => handleDeleteAudio(selectedAudio.id)} className="flex-1 py-2 bg-red-600 text-white text-xs rounded hover:bg-red-700">Delete</button>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
          ) : (
            <p className="text-gray-400 italic">Select an audio asset to view details</p>
          )
        ) : editing ? (
          <div className="space-y-4">
            {/* Header: Name | State | Type */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500">Name</label>
                <input className="w-full p-2 border rounded text-sm font-semibold" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              {editing.states?.[0] && (
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500">State</label>
                  <input className="w-full p-2 border rounded text-sm" value={editing.states[0].name} placeholder="State" onChange={e => { const st = [...editing.states!]; st[0] = { ...st[0], name: e.target.value }; setEditing({ ...editing, states: st }); }} />
                </div>
              )}
              <div className="w-28">
                <label className="text-xs font-medium text-gray-500">Type</label>
                <p className="p-2 text-sm text-gray-600 capitalize">{selected?.type || ''}</p>
              </div>
            </div>
            {/* Descriptions */}
            <div>
              <label className="text-xs font-medium text-gray-500">Asset Description</label>
              <textarea className="w-full p-2 border rounded mt-1 text-sm" rows={2} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </div>
            {editing.states?.[0] && (
              <div>
                <label className="text-xs font-medium text-gray-500">State Description</label>
                <textarea className="w-full p-2 border rounded mt-1 text-sm" rows={2} value={editing.states[0].description} placeholder="State description" onChange={e => { const st = [...editing.states!]; st[0] = { ...st[0], description: e.target.value }; setEditing({ ...editing, states: st }); }} />
              </div>
            )}
            {/* Image previews */}
            {editing.states?.[0] && (
              <div className="flex gap-3">
                <div className="flex-1 border rounded bg-gray-50 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-500">Image <span className="text-gray-400">(assign from gallery)</span></p>
                    <button
                      onClick={handleGenerateImage}
                      disabled={genImage}
                      className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {genImage ? 'Generating...' : 'Generate Image'}
                    </button>
                  </div>
                  {editing.states[0].imagePath ? (
                    <img src={`${baseUrl}${editing.states[0].imagePath}`} alt="Image" className="w-full h-32 object-cover rounded" />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-400">No image</div>
                  )}
                </div>
                {selected?.type !== 'locations' && (
                  <div className="flex-1 border rounded bg-gray-50 p-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-500">Character Sheet <span className="text-gray-400">(assign from gallery)</span></p>
                      <button
                        onClick={handleGenerateSheet}
                        disabled={genSheet || !editing.states[0].imagePath}
                        className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50"
                        title={!editing.states[0].imagePath ? 'Assign an image first' : ''}
                      >
                        {genSheet ? 'Generating...' : 'Generate Sheet'}
                      </button>
                    </div>
                    {editing.states[0].characterSheet ? (
                      <img src={`${baseUrl}${editing.states[0].characterSheet}`} alt="Sheet" className="w-full h-32 object-cover rounded" />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-400">No sheet</div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Prompt */}
            {editing.states?.[0] && (
              <div>
                <label className="text-xs font-medium text-gray-500">Prompt</label>
                <textarea className="w-full p-2 border rounded mt-1 text-sm" rows={6} value={editing.states[0].prompt || ''} placeholder="Prompt" onChange={e => { const st = [...editing.states!]; st[0] = { ...st[0], prompt: e.target.value }; setEditing({ ...editing, states: st }); }} />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleGeneratePrompt()} disabled={generating} className="flex-1 py-2 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50">
                    {generating ? 'Generating...' : 'Generate Prompt'}
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(editing.states![0].prompt || '')} className="flex-1 py-2 bg-gray-600 text-white text-xs rounded hover:bg-gray-700">
                    Copy Prompt
                  </button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-gray-800 text-white text-xs rounded hover:bg-black disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Asset'}
                  </button>
                  <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                    Delete
                  </button>
                </div>
              </div>
            )}
            {error && <p className="text-red-600 text-sm">{error}</p>}
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
                <label className="text-sm font-medium text-slate-700">Asset</label>
                <select value={addExisting || addType} onChange={e => {
                  const v = e.target.value;
                  if (v === 'NEW_CHARACTER' || v === 'NEW_LOCATION' || v === 'NEW_PROP') {
                    setAddType(v.replace('NEW_', '')); setAddExisting('');
                  } else if (v) {
                    setAddExisting(v); setAddType('');
                  }
                }} className="w-full p-2 border rounded mt-1 text-sm">
                  <option value="">Select asset</option>
                  <optgroup label="Characters">
                    <option value="NEW_CHARACTER">+ New Character</option>
                    {(assets.characters || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </optgroup>
                  <optgroup label="Locations">
                    <option value="NEW_LOCATION">+ New Location</option>
                    {(assets.locations || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </optgroup>
                  <optgroup label="Props">
                    <option value="NEW_PROP">+ New Prop</option>
                    {(assets.props || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </optgroup>
                </select>
              </div>
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
              <button onClick={handleAdd} disabled={adding || (!addExisting && !addType) || !addStateName || !addStateDesc || (!addExisting && !addAssetName)}
                className="w-full py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio Import Modal */}
      {showAudioModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowAudioModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-slate-800">Import Audio</h3>
              <button onClick={() => setShowAudioModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Audio File</label>
                <input type="file" accept="audio/*" id="audio-file-input" className="hidden" onChange={e => setAudioFile(e.target.files?.[0] || null)} />
                <button type="button" onClick={() => document.getElementById('audio-file-input')?.click()}
                  className="w-full mt-1 p-3 border-2 border-dashed border-blue-300 rounded text-sm text-blue-600 hover:bg-blue-50 hover:border-blue-400">
                  {audioFile ? `📁 ${audioFile.name}` : '📂 Choose Audio File...'}
                </button>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Name</label>
                <input className="w-full p-2 border rounded mt-1 text-sm" value={audioName} onChange={e => setAudioName(e.target.value)} placeholder="Audio name" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Type</label>
                <select className="w-full p-2 border rounded mt-1 text-sm" value={audioType} onChange={e => setAudioType(e.target.value)}>
                  <option value="VOICE_SAMPLE">Voice Sample</option>
                  <option value="CHARACTER_DIALOG">Character Dialog</option>
                  <option value="SCENE_DIALOG">Scene Dialog</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Transcript</label>
                <textarea className="w-full p-2 border rounded mt-1 text-sm" rows={3} value={audioTranscript} onChange={e => setAudioTranscript(e.target.value)} placeholder="Transcription of the audio..." />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button onClick={handleImportAudio} disabled={audioImporting || !audioFile || !audioName}
                className="w-full py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">
                {audioImporting ? 'Importing...' : 'Import Audio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetsStage;
