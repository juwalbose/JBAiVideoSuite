import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';

type AssetItem = {
  id: string;
  name: string;
  description: string;
  characteristics?: string;
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
  // M39: track whether the component is still mounted to stop polling
  const mountedRef = React.useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioName, setAudioName] = useState('');
  const [audioType, setAudioType] = useState('VOICE_SAMPLE');
  const [audioTranscript, setAudioTranscript] = useState('');
  const [audioImporting, setAudioImporting] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<AudioItem | null>(null);
  const [imageModal, setImageModal] = useState<{ src: string; label: string } | null>(null);

  const refreshAssets = async () => {
    if (!currentProject) return;
    const res = await fetch(`${baseUrl}/projects/${currentProject.id}/assets?episode=${selectedEpisode}`);
    const data = await res.json();
    if (data.status !== 'success') return;
    // Preserve current selection and merge fresh data into editing buffer
    const prevSelected = selected;
    const prevEditing = editing;
    setAssets(data.assets);
    if (prevSelected) {
      const list = data.assets[prevSelected.type as keyof typeof data.assets] || [];
      const asset = list[prevSelected.index];
      if (asset) {
        // Selection still valid — keep it, refresh editing from fresh data
        if (asset.states?.length && prevSelected.stateIndex >= 0 && asset.states[prevSelected.stateIndex]) {
          const s = asset.states[prevSelected.stateIndex];
          setEditing({ id: asset.id, name: asset.name, description: asset.description, characteristics: asset.characteristics, states: [{ ...s }] });
        } else if (!asset.states?.length) {
          setEditing({ id: asset.id, name: asset.name, description: asset.description, characteristics: asset.characteristics, scenes: asset.scenes });
        } else {
          // State index out of bounds — fall back to first state
          const first = asset.states[0];
          setSelected({ type: prevSelected.type, index: prevSelected.index, stateIndex: 0 });
          setEditing({ id: asset.id, name: asset.name, description: asset.description, characteristics: asset.characteristics, states: [{ ...first }] });
        }
      } else {
        // Asset no longer exists — reset
        setSelected(null);
        setEditing(null);
      }
    }
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
    if (activeTab === 'audio') { setSelected(null); setEditing(null); return; }
    const list = assets[activeTab] || [];
    if (list.length === 0) { setSelected(null); setEditing(null); return; }
    const first = list[0];
    const item = first.states?.length
      ? { type: activeTab, index: 0, stateIndex: 0 }
      : { type: activeTab, index: 0, stateIndex: -1 };
    setSelected(item);
    if (first.states?.length) {
      setEditing({ id: first.id, name: first.name, description: first.description, characteristics: first.characteristics, states: [{ ...first.states[0] }] });
    } else {
      setEditing({ id: first.id, name: first.name, description: first.description, characteristics: first.characteristics, scenes: first.scenes });
    }
  }, [assets, activeTab]);

  const getItems = () => {
    if (activeTab === 'audio') return [];
    const list = assets[activeTab] || [];
    const items: { label: string; desc: string; type: string; index: number; stateIndex: number }[] = [];
    list.forEach((a: AssetItem, i: number) => {
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
      setEditing({ id: asset.id, name: asset.name, description: asset.description, characteristics: asset.characteristics, states: [{ ...s }] });
    } else {
      setEditing({ id: asset.id, name: asset.name, description: asset.description, characteristics: asset.characteristics, scenes: asset.scenes });
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
      if (editing.characteristics !== undefined) body.characteristics = editing.characteristics;
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
        // PATCH only the single state that changed — avoids stale full-state snapshot
        const list = assets[item.type as keyof typeof assets];
        const asset = list[item.assetIndex];
        const state = asset.states?.[item.stateIndex];
        if (state) {
          await fetch(`${baseUrl}/projects/${currentProject.id}/assets/${item.assetId}/states/${state.id}?episode=${selectedEpisode}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: data.prompt }),
          });
        }
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
        if (!mountedRef.current) return;
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
          if (mountedRef.current) {
            setError('Polling failed');
            setGenImage(false);
          }
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
        if (!mountedRef.current) return;
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
          if (mountedRef.current) {
            setError('Polling failed');
            setGenSheet(false);
          }
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
    const assetName = editing.name;
    const stateName = editing.states?.[0]?.name;
    const msg = stateId
      ? `Delete state "${stateName}" from "${assetName}"? Shots referencing this state will lose the link.`
      : `Delete "${assetName}" and all its states? Shots referencing this asset will lose the link.`;
    if (!window.confirm(msg)) return;
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
      const audioRes = await fetch(`${baseUrl}/projects/${currentProject.id}/audio?episode=${selectedEpisode}`);
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
      <div className="w-64 border border-border rounded-lg overflow-y-auto h-full flex flex-col bg-card">
        <div className="flex border-b border-border">
          {(['characters', 'locations', 'props', 'audio'] as const).map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setSelected(null); setEditing(null); setSelectedAudio(null); }}
              className={`flex-1 py-2 text-xs font-medium ${activeTab === t ? 'bg-accent-soft text-accent' : 'text-muted-foreground'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="p-2 space-y-1 flex-1 overflow-y-auto">
          {activeTab === 'audio' ? (
            <>
              {audioList.length === 0 && <p className="text-xs text-muted-foreground p-2">No audio assets yet</p>}
              {audioList.map((a) => (
                <button key={a.id} onClick={() => setSelectedAudio(a)}
                  className={`w-full text-left p-2 rounded text-xs hover:bg-muted ${selectedAudio?.id === a.id ? 'bg-accent-soft border border-accent/40' : ''}`}>
                  <span className="font-medium">{a.name}</span>
                  <p className="text-muted-foreground truncate">{a.audioType.replace('_', ' ')}</p>
                </button>
              ))}
            </>
          ) : (
            <>
              {items.length === 0 && <p className="text-xs text-muted-foreground p-2">No assets yet</p>}
              {items.map((item, i) => (
                <button key={i} onClick={() => handleSelect(item)}
                  className={`w-full text-left p-2 rounded text-xs hover:bg-muted ${selected?.index === item.index && selected?.stateIndex === item.stateIndex ? 'bg-accent-soft border border-accent/40' : ''}`}>
                  <span className="font-medium">{item.label}</span>
                  <p className="text-muted-foreground truncate">{item.desc}</p>
                </button>
              ))}
            </>
          )}
        </div>
        <div className="p-2 border-t border-border space-y-1">
          {activeTab === 'audio' ? (
            <button onClick={() => setShowAudioModal(true)} className="w-full py-2 bg-accent text-accent-foreground text-xs rounded hover:bg-accent/80">
              + Import Audio
            </button>
          ) : (
            <>
              <button onClick={() => setShowAddModal(true)} className="w-full py-2 bg-accent text-accent-foreground text-xs rounded hover:bg-accent/80">
                + Add Asset / State
              </button>
              <button onClick={handleGenerateAll} disabled={genAll?.active}
                className="w-full py-2 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50">
                {genAll?.active ? `Generating ${genAll.current}/${genAll.total}...` : '⚡ Generate All Prompts'}
              </button>
              {genAll?.active && (
                <button onClick={() => { abortRef.current = true; }} className="w-full py-1 bg-destructive text-white text-xs rounded hover:bg-red-700">
                  Stop
                </button>
              )}
              {genAll && !genAll.active && (genAll.done > 0 || genAll.failed > 0) && (
                <p className="text-xs text-muted-foreground text-center">{genAll.done} done, {genAll.failed} failed</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: detail preview */}
      <div className="flex-1 border border-border rounded-lg p-4 overflow-y-auto h-full bg-card">
        {activeTab === 'audio' ? (
          selectedAudio ? (
            <div className="space-y-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <input className="w-full p-2 border border-border rounded bg-card text-foreground text-sm font-semibold" value={selectedAudio.name} onChange={e => setSelectedAudio({ ...selectedAudio, name: e.target.value })} />
                </div>
                <div className="w-40">
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <select className="w-full p-2 border border-border rounded bg-card text-foreground text-sm" value={selectedAudio.audioType} onChange={e => setSelectedAudio({ ...selectedAudio, audioType: e.target.value })}>
                    <option value="VOICE_SAMPLE">Voice Sample</option>
                    <option value="CHARACTER_DIALOG">Character Dialog</option>
                    <option value="SCENE_DIALOG">Scene Dialog</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Audio File</label>
                <div className="mt-1 p-2 bg-muted rounded text-sm text-muted-foreground">{selectedAudio.audioPath}</div>
                <audio controls src={`${baseUrl}${selectedAudio.audioPath}`} className="w-full mt-2" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Transcript</label>
                <textarea className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm" rows={4} value={selectedAudio.transcript} onChange={e => setSelectedAudio({ ...selectedAudio, transcript: e.target.value })} placeholder="Transcription of the audio..." />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveAudio} className="flex-1 py-2 bg-muted text-foreground text-xs rounded hover:bg-muted/80">Save Audio</button>
                <button onClick={() => handleDeleteAudio(selectedAudio.id)} className="flex-1 py-2 bg-destructive text-white text-xs rounded hover:bg-red-700">Delete</button>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>
          ) : (
            <p className="text-muted-foreground italic">Select an audio asset to view details</p>
          )
        ) : editing ? (
          <div className="space-y-4">
            {/* Header: Name | State | Type */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <input className="w-full p-2 border border-border rounded bg-card text-foreground text-sm font-semibold" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} disabled={genImage || genSheet} />
              </div>
              {editing.states?.[0] && (
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground">State</label>
                  <input className="w-full p-2 border border-border rounded bg-card text-foreground text-sm" value={editing.states[0].name} placeholder="State" onChange={e => { const st = [...editing.states!]; st[0] = { ...st[0], name: e.target.value }; setEditing({ ...editing, states: st }); }} disabled={genImage || genSheet} />
                </div>
              )}
              <div className="w-28">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <p className="p-2 text-sm text-muted-foreground capitalize">{selected?.type || ''}</p>
              </div>
            </div>
            {/* Descriptions */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Asset Description</label>
              <textarea className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm" rows={2} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} disabled={genImage || genSheet} />
            </div>
            {selected?.type === 'characters' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Characteristics</label>
                <textarea className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm" rows={3} value={editing.characteristics || ''} placeholder="Personality traits, speech patterns, mannerisms..." onChange={e => setEditing({ ...editing, characteristics: e.target.value })} disabled={genImage || genSheet} />
              </div>
            )}
            {editing.states?.[0] && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">State Description</label>
                <textarea className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm" rows={2} value={editing.states[0].description} placeholder="State description" onChange={e => { const st = [...editing.states!]; st[0] = { ...st[0], description: e.target.value }; setEditing({ ...editing, states: st }); }} disabled={genImage || genSheet} />
              </div>
            )}
            {/* Image previews */}
            {editing.states?.[0] && (
              <div className="flex gap-3">
                <div className="flex-1 border border-border rounded bg-muted p-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Image <span className="text-muted-foreground/60">(assign from gallery)</span></p>
                    <button
                      onClick={handleGenerateImage}
                      disabled={genImage}
                      className="px-2 py-0.5 bg-accent text-accent-foreground text-xs rounded hover:bg-accent/80 disabled:opacity-50"
                    >
                      {genImage ? 'Generating...' : 'Generate Image'}
                    </button>
                  </div>
                  {editing.states[0].imagePath ? (
                    <img
                      src={`${baseUrl}${editing.states[0].imagePath}`}
                      alt="Image"
                      className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setImageModal({ src: `${baseUrl}${editing.states[0].imagePath}`, label: 'Image' })}
                    />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-muted/50 rounded text-xs text-muted-foreground">No image</div>
                  )}
                </div>
                {selected?.type !== 'locations' && (
                  <div className="flex-1 border border-border rounded bg-muted p-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Character Sheet <span className="text-muted-foreground/60">(assign from gallery)</span></p>
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
                      <img
                        src={`${baseUrl}${editing.states[0].characterSheet}`}
                        alt="Sheet"
                        className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setImageModal({ src: `${baseUrl}${editing.states[0].characterSheet}`, label: 'Character Sheet' })}
                      />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-muted/50 rounded text-xs text-muted-foreground">No sheet</div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Prompt */}
            {editing.states?.[0] && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Prompt</label>
                <textarea className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm" rows={6} value={editing.states[0].prompt || ''} placeholder="Prompt" onChange={e => { const st = [...editing.states!]; st[0] = { ...st[0], prompt: e.target.value }; setEditing({ ...editing, states: st }); }} disabled={genImage || genSheet} />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleGeneratePrompt()} disabled={generating} className="flex-1 py-2 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50">
                    {generating ? 'Generating...' : 'Generate Prompt'}
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(editing.states![0].prompt || '')} className="flex-1 py-2 bg-muted text-foreground text-xs rounded hover:bg-muted/80">
                    Copy Prompt
                  </button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-muted text-foreground text-xs rounded hover:bg-muted/80 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Asset'}
                  </button>
                  <button onClick={handleDelete} className="flex-1 py-2 bg-destructive text-white text-xs rounded hover:bg-red-700">
                    Delete
                  </button>
                </div>
              </div>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
        ) : (
          <p className="text-muted-foreground italic">Select an asset to view details</p>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-foreground">Add Asset / State</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">&times;</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Asset</label>
                <select value={addExisting || addType} onChange={e => {
                  const v = e.target.value;
                  if (v === 'NEW_CHARACTER' || v === 'NEW_LOCATION' || v === 'NEW_PROP') {
                    setAddType(v.replace('NEW_', '')); setAddExisting('');
                  } else if (v) {
                    setAddExisting(v); setAddType('');
                  }
                }} className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm">
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
                    <label className="text-sm font-medium text-muted-foreground">Asset Name</label>
                    <input className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm" value={addAssetName} onChange={e => setAddAssetName(e.target.value)} placeholder="Asset name" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Asset Description</label>
                    <textarea className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm" rows={2} value={addAssetDesc} onChange={e => setAddAssetDesc(e.target.value)} placeholder="Description" />
                  </div>
                </>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">State Name</label>
                <input className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm" value={addStateName} onChange={e => setAddStateName(e.target.value)} placeholder="State name" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">State Description</label>
                <textarea className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm" rows={2} value={addStateDesc} onChange={e => setAddStateDesc(e.target.value)} placeholder="State description" />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <button onClick={handleAdd} disabled={adding || (!addExisting && !addType) || !addStateName || !addStateDesc || (!addExisting && !addAssetName)}
                className="w-full py-2 bg-accent text-accent-foreground text-sm rounded hover:bg-accent/80 disabled:opacity-50">
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Image Modal */}
      {imageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setImageModal(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white text-4xl leading-none z-10"
            onClick={() => setImageModal(null)}
            aria-label="Close"
          >
            &times;
          </button>
          <div className="flex flex-col items-center gap-2 max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img
              src={imageModal.src}
              alt={imageModal.label}
              className="max-w-full max-h-[85vh] object-contain rounded"
            />
            <p className="text-white/60 text-sm">{imageModal.label}</p>
          </div>
        </div>
      )}

      {/* Audio Import Modal */}
      {showAudioModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowAudioModal(false)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-foreground">Import Audio</h3>
              <button onClick={() => setShowAudioModal(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">&times;</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Audio File</label>
                <input type="file" accept="audio/*" id="audio-file-input" className="hidden" onChange={e => setAudioFile(e.target.files?.[0] || null)} />
                <button type="button" onClick={() => document.getElementById('audio-file-input')?.click()}
                  className="w-full mt-1 p-3 border-2 border-dashed border-accent/40 rounded text-sm text-accent hover:bg-accent-soft hover:border-accent/60">
                  {audioFile ? `📁 ${audioFile.name}` : '📂 Choose Audio File...'}
                </button>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <input className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm" value={audioName} onChange={e => setAudioName(e.target.value)} placeholder="Audio name" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Type</label>
                <select className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm" value={audioType} onChange={e => setAudioType(e.target.value)}>
                  <option value="VOICE_SAMPLE">Voice Sample</option>
                  <option value="CHARACTER_DIALOG">Character Dialog</option>
                  <option value="SCENE_DIALOG">Scene Dialog</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Transcript</label>
                <textarea className="w-full p-2 border border-border rounded bg-card text-foreground mt-1 text-sm" rows={3} value={audioTranscript} onChange={e => setAudioTranscript(e.target.value)} placeholder="Transcription of the audio..." />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <button onClick={handleImportAudio} disabled={audioImporting || !audioFile || !audioName}
                className="w-full py-2 bg-accent text-accent-foreground text-sm rounded hover:bg-accent/80 disabled:opacity-50">
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
