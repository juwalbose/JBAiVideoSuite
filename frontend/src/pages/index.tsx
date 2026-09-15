import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import StoryStage from '../components/studio/StoryStage';
import ScriptStage from '../components/studio/ScriptStage';
import AssetsStage from '../components/studio/AssetsStage';
import ShotListStage from '../components/studio/ShotListStage';
import FinalVideoStage from '../components/studio/FinalVideoStage';
import ProjectLibrary from '../components/studio/ProjectLibrary';
import Settings from './Settings';
import ComfyUIPlayground from '../components/playground/ComfyUIPlayground';
import Docs from '../components/Docs';
import ChatPanel from '../components/ChatPanel';
import { useSettingsStore } from '../store/settingsStore';

const Studio = () => {
  const { currentProject, setCurrentProject, fetchProjects, deleteProject } = useProjectStore();
  const [llmStatus, setLlmStatus] = useState('Connecting...');
  const [comfyStatus, setComfyStatus] = useState('Connecting...');
  const [activeTab, setActiveTab] = useState('app');
  const [stageTab, setStageTab] = useState('story');
  const [episodeCount, setEpisodeCount] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [chatOpen, setChatOpen] = useState(true);

  const { loadSettings } = useSettingsStore();

  const [llmAction, setLlmAction] = useState<'loading' | 'unloading' | null>(null);

  const loadLlm = async () => {
    const { backend } = useSettingsStore.getState();
    if (!backend?.apiUrl) return;
    setLlmAction('loading');
    try {
      await fetch(`${backend.apiUrl}/llm/load`, { method: 'POST' });
    } catch (e) {
      console.error('LLM load failed:', e);
    } finally {
      setLlmAction(null);
      checkStatuses();
    }
  };

  const unloadLlm = async () => {
    const { backend } = useSettingsStore.getState();
    if (!backend?.apiUrl) return;
    setLlmAction('unloading');
    try {
      await fetch(`${backend.apiUrl}/llm/unload`, { method: 'POST' });
    } catch (e) {
      console.error('LLM unload failed:', e);
    } finally {
      setLlmAction(null);
      checkStatuses();
    }
  };

  const checkStatuses = () => {
    const { backend, comfyui } = useSettingsStore.getState();
    if (!backend?.apiUrl) return;
    const timeout = 3000;
    setLlmStatus('Connecting...');
    setComfyStatus('Connecting...');
    const llmPromise = fetch(`${backend.apiUrl}/handshake`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'healthy') setLlmStatus(`🟢 ${data.active_model}`);
        else if (data.status === 'no_models') setLlmStatus('🔵 No Models Loaded');
        else setLlmStatus(`🔴 ${data.status.toUpperCase()}`);
      })
      .catch(() => setLlmStatus('🔴 Unreachable'));
    const comfyPromise = fetch(`${backend.apiUrl}/comfyui/check?host=${comfyui.ip}&port=${comfyui.port}`)
      .then(res => res.json())
      .then(data => {
        if (data.available) setComfyStatus('🟢 Online');
        else setComfyStatus('🔴 Offline');
      })
      .catch(() => setComfyStatus('🔴 Unreachable'));
    Promise.race([llmPromise, new Promise(r => setTimeout(r, timeout))]);
    Promise.race([comfyPromise, new Promise(r => setTimeout(r, timeout))]);
  };

  useEffect(() => {
    loadSettings().then(() => {
      fetchProjects();
      checkStatuses();
    });
  }, [loadSettings]);

  useEffect(() => {
    const handler = () => setChatOpen(true);
    window.addEventListener('open-chat', handler);
    return () => window.removeEventListener('open-chat', handler);
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground">
      {/* Top Navigation Tabs */}
      <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-card">
        <div className="font-bold text-xl text-foreground">JBAiVideoSuite</div>
        <nav className="flex gap-8 items-center">
          <button 
            onClick={() => setActiveTab('app')}
            className={`transition-colors ${activeTab === 'app' ? 'border-b-2 border-accent text-accent' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Direct The Video
          </button>
          <button 
            onClick={() => setActiveTab('playground')}
            className={`transition-colors ${activeTab === 'playground' ? 'border-b-2 border-accent text-accent' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Comfy Generation
          </button>
          <button 
            onClick={() => setActiveTab('docs')}
            className={`transition-colors ${activeTab === 'docs' ? 'border-b-2 border-accent text-accent' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Docs
          </button>
        </nav>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-1">
            <span className={`text-sm font-mono ${llmStatus.startsWith('🟢') ? 'text-success' : llmStatus.includes('No Models') ? 'text-accent' : 'text-destructive'}`}>
              LLM: {llmStatus}
            </span>
            <button onClick={checkStatuses} className="text-muted-foreground hover:text-accent transition-colors" title="Re-check LLM status">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
            {llmStatus.includes('No Models') && (
              <button onClick={loadLlm} disabled={llmAction !== null} className="text-muted-foreground hover:text-success transition-colors disabled:opacity-50" title="Load model">
                <svg className={`w-3.5 h-3.5 ${llmAction === 'loading' ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" /><path d="M5 12h14" />
                </svg>
              </button>
            )}
            {llmStatus.startsWith('🟢') && (
              <button onClick={unloadLlm} disabled={llmAction !== null} className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50" title="Unload model">
                <svg className={`w-3.5 h-3.5 ${llmAction === 'unloading' ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-sm font-mono ${comfyStatus.includes('Online') ? 'text-success' : 'text-destructive'}`}>
              ComfyUI: {comfyStatus}
            </span>
            <button onClick={checkStatuses} className="text-muted-foreground hover:text-accent transition-colors" title="Re-check ComfyUI status">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`transition-colors ${activeTab === 'settings' ? 'border-b-2 border-accent text-accent' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Settings
          </button>
        </div>
      </header>

      {/* Main Workspace + Chat Panel */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Main content area (shrinks when chat is open) */}
        <div className={`flex flex-1 overflow-hidden transition-all duration-300 ${chatOpen ? 'w-3/4' : 'w-full'}`}>
          {activeTab === 'app' && (
            <>
              {!currentProject ? (
                <div className="flex flex-col items-center justify-center h-full w-full p-8 gap-8">
                  <div className="text-center">
                    <h2 className="text-3xl font-bold text-muted-foreground mb-4">No Project Selected</h2>
                    <p className="text-muted-foreground max-w-md mx-auto">Choose a project from your library or create a new one to begin.</p>
                  </div>
                  <div className="w-full max-w-2xl">
                    <ProjectLibrary />
                  </div>
                </div>
              ) : (
                <>
                  <main className="flex-1 p-8 overflow-y-auto">
                    <div className="max-w-4xl mx-auto">
                      {currentProject && (
                        <div className="mb-4 flex items-center justify-between">
                          <button 
                            onClick={() => setCurrentProject(null)}
                            className="text-accent hover:underline flex items-center gap-2 transition-colors"
                          >
                            ← Back to Library
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete "${currentProject.name}"? This cannot be undone.`)) {
                                deleteProject(currentProject.id);
                              }
                            }}
                            className="text-xs px-2 py-1 rounded bg-destructive text-white hover:bg-red-700 transition-colors"
                          >
                            Delete Project
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mb-4">
                        <h1 className="text-3xl font-bold">{currentProject?.name}</h1>
                        {currentProject?.type && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            currentProject.type === 'episodic'
                              ? 'bg-purple-900/40 text-purple-300'
                              : 'bg-accent-soft text-accent'
                          }`}>
                            {currentProject.type === 'episodic' ? 'Episodic' : 'Single Video'}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-1 border-b border-border mb-6">
                        {['story', 'script', 'assets', 'shotlist', 'final'].map((stage) => (
                          <button
                            key={stage}
                            onClick={() => setStageTab(stage)}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                              stageTab === stage
                                ? 'border-accent text-accent'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {stage === 'story' ? '1. Story' : stage === 'script' ? '2. Script' : stage === 'assets' ? '3. Assets' : stage === 'shotlist' ? '4. Shot List' : '5. Final Video'}
                          </button>
                        ))}
                      </div>

                      {stageTab === 'story' && (
                        <div>
                          {currentProject?.story ? (
                            <StoryStage selectedEpisode={selectedEpisode} onEpisodeCountChange={setEpisodeCount} onNavigateToScript={() => setStageTab('script')} />
                          ) : (
                            <div className="p-8 border-2 border-dashed border-border rounded-xl text-center">
                              <p className="text-muted-foreground italic">No story yet. Create a project to begin.</p>
                            </div>
                          )}
                        </div>
                      )}
                      {stageTab === 'script' && (
                        <div className="space-y-4">
                          {currentProject?.type === 'episodic' && (
                            <div className="flex items-center gap-3">
                              <label className="text-sm font-medium text-muted-foreground">Episode:</label>
                              <select
                                value={selectedEpisode}
                                onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                                className="p-2 border border-border rounded bg-card text-foreground"
                              >
                                {Array.from({ length: episodeCount }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>Episode {i + 1}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <ScriptStage selectedEpisode={selectedEpisode} onNavigateToAssets={() => setStageTab('assets')} />
                        </div>
                      )}
                      {stageTab === 'assets' && (
                        <div className="space-y-4">
                          {currentProject?.type === 'episodic' && (
                            <div className="flex items-center gap-3">
                              <label className="text-sm font-medium text-muted-foreground">Episode:</label>
                              <select
                                value={selectedEpisode}
                                onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                                className="p-2 border border-border rounded bg-card text-foreground"
                              >
                                {Array.from({ length: episodeCount }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>Episode {i + 1}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <AssetsStage selectedEpisode={selectedEpisode} />
                        </div>
                      )}
                      {stageTab === 'shotlist' && (
                        <div className="space-y-4">
                          {currentProject?.type === 'episodic' && (
                            <div className="flex items-center gap-3">
                              <label className="text-sm font-medium text-muted-foreground">Episode:</label>
                              <select
                                value={selectedEpisode}
                                onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                                className="p-2 border border-border rounded bg-card text-foreground"
                              >
                                {Array.from({ length: episodeCount }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>Episode {i + 1}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <ShotListStage selectedEpisode={selectedEpisode} />
                        </div>
                      )}
                      {stageTab === 'final' && (
                        <div className="space-y-4">
                          {currentProject?.type === 'episodic' && (
                            <div className="flex items-center gap-3">
                              <label className="text-sm font-medium text-muted-foreground">Episode:</label>
                              <select
                                value={selectedEpisode}
                                onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                                className="p-2 border border-border rounded bg-card text-foreground"
                              >
                                {Array.from({ length: episodeCount }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>Episode {i + 1}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <FinalVideoStage selectedEpisode={selectedEpisode} />
                        </div>
                      )}
                    </div>
                  </main>
                </>
              )}
            </>
          )}

          {activeTab === 'playground' && (
            <div className="flex flex-1 items-center justify-center p-8">
              <ComfyUIPlayground />
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="flex-1 overflow-y-auto">
              <Docs />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex flex-1 items-center justify-center p-8">
              <Settings />
            </div>
          )}
        </div>

        {/* Chat Panel (right side) */}
        <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      </div>
    </div>
  );
};

export default Studio;
