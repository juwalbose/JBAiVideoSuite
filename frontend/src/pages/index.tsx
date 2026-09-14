import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import StoryStage from '../components/studio/StoryStage';
import ScriptStage from '../components/studio/ScriptStage';
import AssetsStage from '../components/studio/AssetsStage';
import ShotListStage from '../components/studio/ShotListStage';
import ProjectLibrary from '../components/studio/ProjectLibrary';
import Settings from './Settings';
import ComfyUIPlayground from '../components/playground/ComfyUIPlayground';
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

  useEffect(() => {
    loadSettings().then(() => {
      fetchProjects();
      const { backend, comfyui } = useSettingsStore.getState();
      if (!backend?.apiUrl) return;
      const timeout = 3000;
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
    });
  }, [loadSettings]);

  useEffect(() => {
    const handler = () => setChatOpen(true);
    window.addEventListener('open-chat', handler);
    return () => window.removeEventListener('open-chat', handler);
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-white text-black">
      {/* Top Navigation Tabs */}
      <header className="h-16 border-b flex items-center justify-between px-8 bg-gray-50">
        <div className="font-bold text-xl">BionicProducer</div>
        <nav className="flex gap-8 items-center">
          <button 
            onClick={() => setActiveTab('app')}
            className={`hover:text-blue-600 transition-colors ${activeTab === 'app' ? 'border-b-2 border-blue-600' : ''}`}
          >
            App
          </button>
          <button 
            onClick={() => setActiveTab('playground')}
            className={`hover:text-blue-600 transition-colors ${activeTab === 'playground' ? 'border-b-2 border-blue-600' : ''}`}
          >
            Playground
          </button>
        </nav>
        <div className="flex gap-4 items-center">
          <span className={`text-sm font-mono ${llmStatus.startsWith('🟢') ? 'text-green-600' : llmStatus.includes('No Models') ? 'text-blue-600' : 'text-red-600'}`}>
            LLM: {llmStatus}
          </span>
          <span className={`text-sm font-mono ${comfyStatus.includes('Online') ? 'text-green-600' : 'text-red-600'}`}>
            ComfyUI: {comfyStatus}
          </span>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`hover:text-blue-600 transition-colors ${activeTab === 'settings' ? 'border-b-2 border-blue-600' : ''}`}
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
                    <h2 className="text-3xl font-bold text-gray-500 mb-4">No Project Selected</h2>
                    <p className="text-gray-400 max-w-md mx-auto">Choose a project from your library or create a new one to begin.</p>
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
                            className="text-blue-600 hover:underline flex items-center gap-2 transition-colors"
                          >
                            ← Back to Library
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete "${currentProject.name}"? This cannot be undone.`)) {
                                deleteProject(currentProject.id);
                              }
                            }}
                            className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
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
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {currentProject.type === 'episodic' ? 'Episodic' : 'Single Video'}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-1 border-b mb-6">
                        {['story', 'script', 'assets', 'shotlist', 'final'].map((stage) => (
                          <button
                            key={stage}
                            onClick={() => setStageTab(stage)}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                              stageTab === stage
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {stage === 'story' ? '1. Story' : stage === 'script' ? '2. Script' : stage === 'assets' ? '3. Assets' : stage === 'shotlist' ? '4. Shot List' : '5. Final Video'}
                          </button>
                        ))}
                      </div>

                      {stageTab === 'story' && (
                        <div>
                          {currentProject?.story ? (
                            <StoryStage onEpisodeCountChange={setEpisodeCount} onNavigateToScript={() => setStageTab('script')} />
                          ) : (
                            <div className="p-8 border-2 border-dashed border-gray-200 rounded-xl text-center">
                              <p className="text-gray-400 italic">No story yet. Create a project to begin.</p>
                            </div>
                          )}
                        </div>
                      )}
                      {stageTab === 'script' && (
                        <div className="space-y-4">
                          {currentProject?.type === 'episodic' && (
                            <div className="flex items-center gap-3">
                              <label className="text-sm font-medium text-gray-700">Episode:</label>
                              <select
                                value={selectedEpisode}
                                onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                                className="p-2 border rounded bg-white text-black"
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
                        <AssetsStage />
                      )}
                      {stageTab === 'shotlist' && (
                        <div className="space-y-4">
                          {currentProject?.type === 'episodic' && (
                            <div className="flex items-center gap-3">
                              <label className="text-sm font-medium text-gray-700">Episode:</label>
                              <select
                                value={selectedEpisode}
                                onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                                className="p-2 border rounded bg-white text-black"
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
                              <label className="text-sm font-medium text-gray-700">Episode:</label>
                              <select
                                value={selectedEpisode}
                                onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                                className="p-2 border rounded bg-white text-black"
                              >
                                {Array.from({ length: episodeCount }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>Episode {i + 1}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="p-8 border-2 border-dashed border-gray-200 rounded-xl text-center">
                            <p className="text-gray-400 italic">
                              {currentProject?.type === 'episodic'
                                ? `Final video for Episode ${selectedEpisode} will appear here.`
                                : 'Final video will appear here.'}
                            </p>
                          </div>
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
