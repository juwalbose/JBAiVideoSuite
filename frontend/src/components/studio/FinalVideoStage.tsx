import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';

interface ShotData {
  shot: number;
  scene: number;
  beats: number[];
  loc: string;
  subs: string[];
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
  imagePath: string;
  characterSheet: string;
}

interface AssetItem {
  id: string;
  name: string;
  description: string;
  states: AssetState[];
}

interface AudioItem {
  id: string;
  name: string;
  audioPath: string;
  audioType: string;
}

const FinalVideoStage = ({ selectedEpisode }: { selectedEpisode: number }) => {
  const { currentProject } = useProjectStore();
  const baseUrl = useSettingsStore.getState().backend.apiUrl;

  const [subTab, setSubTab] = useState<'generate' | 'assemble'>('generate');
  const [shots, setShots] = useState<ShotData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [projectAssets, setProjectAssets] = useState<{ characters: AssetItem[]; locations: AssetItem[]; props: AssetItem[] }>({ characters: [], locations: [], props: [] });
  const [audioAssets, setAudioAssets] = useState<AudioItem[]>([]);
  const [seed, setSeed] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [assembleIdx, setAssembleIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);


  useEffect(() => {
    if (!currentProject) return;
    fetch(`${baseUrl}/projects/${currentProject.id}/shotlist?episode=${selectedEpisode}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setShots(data.map(mapShot));
          setSelectedIdx(0);
        }
      })
      .catch(console.error);
    fetch(`${baseUrl}/projects/${currentProject.id}/assets?episode=${selectedEpisode}`)
      .then((r) => r.json())
      .then((data) => { if (data.status === 'success') setProjectAssets(data.assets); })
      .catch(console.error);
    fetch(`${baseUrl}/projects/${currentProject.id}/audio?episode=${selectedEpisode}`)
      .then((r) => r.json())
      .then((data) => { if (data.status === 'success') setAudioAssets(data.audio); })
      .catch(console.error);
  }, [currentProject?.id, selectedEpisode]);

  const parseArr = (v: any): string[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v.startsWith('[')) {
      try { return JSON.parse(v); } catch { return []; }
    }
    return [];
  };

  const mapShot = (s: any): ShotData => ({
    shot: Number(s.shot) || 0,
    scene: Number(s.scene) || 0,
    beats: parseArr(s.beats),
    loc: s.loc || '',
    subs: parseArr(s.subs),
    frames: Number(s.frames) || 0,
    duration: Number(s.duration) || 0,
    camera: s.camera || '',
    action: s.action || '',
    dialogue: s.dialogue || '',
    note: s.note || '',
    prompt: s.prompt || '',
    locationAssetId: s.locationAssetId || null,
    locationStateId: s.locationStateId || null,
    characterAssetIds: parseArr(s.characterAssetIds),
    characterStateIds: parseArr(s.characterStateIds),
    propAssetIds: parseArr(s.propAssetIds),
    propStateIds: parseArr(s.propStateIds),
    sceneDialogAudioId: s.sceneDialogAudioId || null,
    characterAudioIds: parseArr(s.characterAudioIds),
    characterAudioTypes: parseArr(s.characterAudioTypes),
    musicOn: !!s.musicOn,
    musicDesc: s.musicDesc || '',
    videoPath: s.videoPath || null,
  });

  const shot = shots[selectedIdx];

  useEffect(() => {
    if (shot?.videoPath) {
      setVideoUrl(`${baseUrl}${shot.videoPath}`);
    } else {
      setVideoUrl(null);
    }
  }, [selectedIdx, currentProject?.id]);

  const findAsset = (list: AssetItem[], assetId: string | null, stateId: string | null): { asset: AssetItem; state: AssetState } | null => {
    if (!assetId) return null;
    const asset = list.find((a) => a.id === assetId);
    if (!asset) return null;
    const state = stateId ? asset.states.find((s) => s.id === stateId) : asset.states[0];
    return state ? { asset, state } : null;
  };

  const locationState = findAsset(projectAssets.locations, shot?.locationAssetId, shot?.locationStateId);
  const characterStates = shot?.characterAssetIds.map((aid, i) => findAsset(projectAssets.characters, aid, shot.characterStateIds[i]));
  const propStates = shot?.propAssetIds.map((aid, i) => findAsset(projectAssets.props, aid, shot.propStateIds[i]));

  const shotAudios: AudioItem[] = [];
  if (shot?.sceneDialogAudioId) {
    const a = audioAssets.find((a) => a.id === shot.sceneDialogAudioId);
    if (a) shotAudios.push(a);
  }
  if (shot?.characterAudioIds) {
    shot.characterAudioIds.forEach((aid) => {
      const a = audioAssets.find((a) => a.id === aid);
      if (a) shotAudios.push(a);
    });
  }

  const pollStatus = (taskId: string, resolution: 'low' | 'high') => {
    const check = async () => {
      try {
        const res = await fetch(`${baseUrl}/projects/${currentProject!.id}/videogen/status/${taskId}`);
        const data = await res.json();
        if (data.status === 'complete') {
          const url = `${baseUrl}${data.videoPath}`;
          setVideoUrl(url);
          if (resolution === 'high') {
            setShots((prev) => prev.map((s, i) => (i === selectedIdx ? { ...s, videoPath: data.videoPath } : s)));
          }
          setIsGenerating(false);
        } else if (data.status === 'pending') {
          setTimeout(check, 3000);
        } else {
          console.error('Video gen error:', data.details);
          setIsGenerating(false);
        }
      } catch (err) {
        console.error('Poll error:', err);
        setTimeout(check, 3000);
      }
    };
    setTimeout(check, 1000);
  };

  const handleGenerate = async (resolution: 'low' | 'high') => {
    if (!currentProject || !shot) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`${baseUrl}/projects/${currentProject.id}/videogen/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shot: shot.shot, resolution, seed, prompt: shot.prompt, episode: selectedEpisode }),
      });
      const data = await res.json();
      if (data.status === 'error') {
        console.error('Generate failed:', data.details);
        setIsGenerating(false);
        return;
      }
      pollStatus(data.task_id, resolution);
    } catch (err) {
      console.error('Generate error:', err);
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!currentProject || !shot) return;
    setIsSaving(true);
    setSaved(false);
    try {
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/shotlist?episode=${selectedEpisode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shots }),
      });
      const data = await response.json();
      if (data.status === 'error') { console.error('Save failed:', data.details); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error saving shot:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderImagePreview = (label: string, result: { asset: AssetItem; state: AssetState } | null, isCharacter: boolean) => {
    const state = result?.state;
    const imgPath = isCharacter && state?.characterSheet ? state.characterSheet : state?.imagePath;
    const name = result ? `${result.asset.name}${state?.name ? ` — ${state.name}` : ''}` : '';
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-muted-foreground uppercase">{label}</span>
        {name && <span className="text-[10px] text-muted-foreground truncate max-w-[96px]">{name}</span>}
        {imgPath ? (
          <img
            src={`${baseUrl}${imgPath}`}
            alt={label}
            className="w-24 h-24 object-cover rounded border border-border"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`w-24 h-24 bg-muted rounded border border-border flex items-center justify-center text-[10px] text-muted-foreground ${imgPath ? 'hidden' : ''}`}>
          Image missing
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setSubTab('generate')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            subTab === 'generate' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Generate Clips
        </button>
        <button
          onClick={() => setSubTab('assemble')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            subTab === 'assemble' ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Assemble Clips
        </button>
      </div>

      {subTab === 'generate' && (
        <>
          {/* Shot selector */}
          {shots.length > 0 && shot && (
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
              <span className="ml-auto text-xs text-muted-foreground">
                Shot {shot.shot} · {shot.duration}s
              </span>
            </div>
          )}

          {/* Video preview pane */}
          <div className="w-full aspect-[960/544] bg-black rounded shadow-md border border-border overflow-hidden">
            {videoUrl ? (
              <video src={videoUrl} controls className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground italic">
                Video preview will appear here
              </div>
            )}
          </div>

          {/* Shot detail pane */}
          {shot && (
            <div className="p-4 border border-border rounded-lg bg-card shadow-sm space-y-4">
              {/* Prompt */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Prompt</label>
                <textarea
                  className="w-full px-2 py-1 border border-border rounded text-sm bg-card text-foreground resize-y"
                  rows={4}
                  value={shot.prompt}
                  onChange={(e) => {
                    setShots((prev) => prev.map((s, i) => (i === selectedIdx ? { ...s, prompt: e.target.value } : s)));
                  }}
                />
              </div>

              {/* Asset previews */}
              <div className="flex flex-wrap gap-4">
                {locationState && renderImagePreview('Location', locationState, false)}
                {characterStates.map((state, i) => (
                  <React.Fragment key={`char-${i}`}>
                    {renderImagePreview(`Character ${i + 1}`, state, true)}
                  </React.Fragment>
                ))}
                {propStates.map((state, i) => (
                  <React.Fragment key={`prop-${i}`}>
                    {renderImagePreview(`Prop ${i + 1}`, state, false)}
                  </React.Fragment>
                ))}
              </div>

              {/* Audio */}
              {shotAudios.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">Audio</label>
                  <div className="flex flex-col gap-2">
                    {shotAudios.map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-32 truncate">{a.name}</span>
                        <audio src={`${baseUrl}${a.audioPath}`} controls className="flex-1 h-8" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seed + Generate buttons */}
              <div className="flex items-center gap-4 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Duration</label>
                  <input
                    type="number"
                    step="0.1"
                    className="px-2 py-1 border border-border rounded text-sm bg-card text-foreground w-20"
                    value={shot.duration}
                    onChange={(e) => {
                      setShots((prev) => prev.map((s, i) => (i === selectedIdx ? { ...s, duration: Number(e.target.value) } : s)));
                    }}
                  />
                  <span className="text-xs text-muted-foreground">s</span>
                  <label className="text-xs font-medium text-muted-foreground ml-2">Seed</label>
                  <input
                    type="number"
                    className="px-2 py-1 border border-border rounded text-sm bg-card text-foreground w-32"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value))}
                  />
                  <button
                    type="button"
                    onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                    className="px-3 py-1 text-xs bg-muted text-foreground border border-border rounded hover:bg-muted/80 transition-colors"
                  >
                    Randomize
                  </button>
                </div>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => handleGenerate('low')}
                    disabled={isGenerating}
                    className="px-4 py-2 bg-accent text-accent-foreground rounded text-sm hover:bg-accent/80 transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? 'Generating...' : 'Gen Low Res'}
                  </button>
                  <button
                    onClick={() => handleGenerate('high')}
                    disabled={isGenerating}
                    className="px-4 py-2 bg-success text-white rounded text-sm hover:bg-success/80 transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? 'Generating...' : 'Gen High Res'}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-muted text-foreground rounded text-sm hover:bg-muted/80 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              {saved && (
                <div className="p-2 border border-success/40 bg-success/10 rounded text-success text-xs">
                  Shot saved successfully.
                </div>
              )}
            </div>
          )}

          {shots.length === 0 && (
            <div className="p-4 border border-border rounded bg-muted text-muted-foreground text-sm text-center">
              No shots found. Generate shots in the Shot List tab first.
            </div>
          )}
        </>
      )}

      {subTab === 'assemble' && (
        <div className="space-y-4">
          {/* Video preview */}
          <div className="w-full aspect-video bg-black rounded shadow-md border border-border overflow-hidden">
            {shots[assembleIdx]?.videoPath ? (
              <video
                key={assembleIdx}
                src={`${baseUrl}${shots[assembleIdx].videoPath}`}
                controls
                className="assemble-preview-video w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground italic">
                No video generated for Shot {shots[assembleIdx]?.shot ?? '?'}
              </div>
            )}
          </div>

          {/* Play sequence button */}
          <div className="flex justify-center">
            <button
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false);
                  return;
                }
                setIsPlaying(true);
                const playNext = (idx: number) => {
                  if (idx >= shots.length) {
                    setIsPlaying(false);
                    return;
                  }
                  setAssembleIdx(idx);
                  const shot = shots[idx];
                  if (shot?.videoPath) {
                    const video = document.querySelector<HTMLVideoElement>('.assemble-preview-video');
                    if (video) {
                      video.onended = () => playNext(idx + 1);
                      video.play();
                    }
                  } else {
                    setTimeout(() => playNext(idx + 1), 1500);
                  }
                };
                playNext(0);
              }}
              className="px-6 py-2 bg-accent text-accent-foreground rounded text-sm hover:bg-accent/80 transition-colors"
            >
              {isPlaying ? 'Stop' : 'Play Sequence'}
            </button>
          </div>

          {/* Shot strip */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {shots.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setIsPlaying(false);
                  setAssembleIdx(i);
                }}
                className={`relative flex-shrink-0 w-20 h-14 rounded border-2 overflow-hidden ${
                  assembleIdx === i ? 'border-accent' : 'border-border hover:border-muted-foreground'
                }`}
              >
                {s.videoPath ? (
                  <video
                    src={`${baseUrl}${s.videoPath}`}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                    No video
                  </div>
                )}
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                  {s.shot}
                </span>
              </button>
            ))}
          </div>

          {/* Export button */}
          <div className="flex justify-center">
            <button
              disabled
              className="px-6 py-2 bg-muted text-muted-foreground rounded text-sm cursor-not-allowed opacity-60"
              title="Export functionality coming soon"
            >
              Export Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinalVideoStage;
