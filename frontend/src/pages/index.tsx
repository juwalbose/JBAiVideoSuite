import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import StoryStage from '../components/studio/StoryStage';
import ProjectLibrary from '../components/studio/ProjectLibrary';
import Settings from './Settings';
import { useSettingsStore } from '../store/settingsStore';

const Studio = () => {
  const { currentProject, setCurrentProject, fetchProjects } = useProjectStore();
  const [status, setStatus] = useState('Connecting...');
  const [activeTab, setActiveTab] = useState('app'); // 'app', 'playground', 'settings'

  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    // 1. Load settings from DB first
    loadSettings().then(() => {
      // 2. Start fetching projects immediately (non-blocking)
      fetchProjects();

      // 3. Perform handshake in the background to update status
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      fetch(`${baseUrl}/handshake`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'healthy') {
            setStatus('🟢 Healthy');
          } else if (data.status === 'no_models') {
            setStatus('🔵 No Models Loaded');
          } else {
            setStatus(`🔴 ${data.status.toUpperCase()}: ${data.details}`);
          }
        })
        .catch(() => {
          setStatus('🔴 Unreachable');
        });
    });
  }, [loadSettings]);

  const handleCreateProject = async () => {
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My New Story', description: '' }),
      });

      if (!response.ok) throw new Error('Failed to create project');
      const data = await response.json();
      setCurrentProject({
        id: data.id,
        name: data.name,
        description: data.description,
        beats: data.beats || [],
        assets: data.assets || [],
        story: data.story
      });
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-white text-black">
      {/* Top Navigation Tabs */}
      <header className="h-16 border-b flex items-center justify-between px-8 bg-gray-50">
        <div className="font-bold text-xl">BionicProducer</div>
        <nav className="flex gap-8 items-center">
          <span className={`text-sm font-mono ${status.includes('healthy') ? 'text-green-600' : status.includes('no_models') ? 'text-blue-600' : 'text-red-600'}`}>
            {status}
          </span>
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
          <button 
            onClick={() => setActiveTab('settings')}
            className={`hover:text-blue-600 transition-colors ${activeTab === 'settings' ? 'border-b-2 border-blue-600' : ''}`}
          >
            Settings
          </button>
        </nav>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
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
                {/* Left Sidebar (The Flow) - Only visible when inside a project */}
                <aside className="w-64 border-r bg-white p-4 flex flex-col gap-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">The Flow</h3>
                  <nav className="flex flex-col gap-2">
                    <button className="p-2 rounded hover:bg-blue-100 transition-colors border border-transparent hover:border-blue-300">1. Story</button>
                    <button className="p-2 rounded hover:bg-blue-100 transition-colors border border-transparent hover:border-blue-300">2. Script</button>
                    <button className="p-2 rounded hover:bg-blue-100 transition-colors border border-transparent hover:border-blue-300">3. Assets</button>
                    <button className="p-2 rounded hover:bg-blue-100 transition-colors border border-transparent hover:border-blue-300">4. Shot List</button>
                    <button className="p-2 rounded hover:bg-blue-100 transition-colors border border-transparent hover:border-blue-300">5. Final Video</button>
                  </nav>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 p-8 overflow-y-auto">
                  <div className="max-w-4xl mx-auto">
                    {currentProject && (
                      <button 
                        onClick={() => setCurrentProject(null)}
                        className="mb-4 text-blue-600 hover:underline flex items-center gap-2 transition-colors"
                      >
                        ← Back to Library
                      </button>
                    )}
                    <h1 className="text-3xl font-bold mb-2">{currentProject?.name}</h1>
                    {currentProject?.description && <p className="mb-8 text-gray-600">{currentProject.description}</p>}
                    
                    <div className="mt-12">
                      {currentProject?.story ? (
                        <StoryStage story={currentProject.story} />
                      ) : (
                        <div className="p-8 border-2 border-dashed border-gray-200 rounded-xl text-center">
                          <p className="text-gray-400 italic">No story yet. Create a project to begin.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </main>
              </>
            )}
          </>
        )}

        {activeTab === 'playground' && (
          <div className="flex flex-1 items-center justify-center p-8">
             <p className="text-gray-500">Playground coming soon...</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex flex-1 items-center justify-center p-8">
            <Settings />
          </div>
        )}
      </div>
    </div>
  );
};

export default Studio;