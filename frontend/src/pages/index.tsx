import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import StoryStage from '../components/studio/StoryStage';
import ProjectLibrary from '../components/studio/ProjectLibrary';

const Studio = () => {
  const { currentProject, setProject } = useProjectStore();
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    // Check if backend is alive on load
    fetch('http://127.0.0.1:8000/handshake')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'healthy') {
          setStatus('🟢 Healthy');
        } else {
          setStatus(`🔴 ${data.status.toUpperCase()}: ${data.details}`);
        }
      })
      .catch(() => {
        setStatus('🔴 Unreachable');
      });
  }, []);

  const handleCreateProject = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/projects/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My New Story', description: '' }),
      });

      if (!response.ok) throw new Error('Failed to create project');
      const data = await response.json();
      setProject({
        id: data.id,
        name: data.name,
        description: data.description,
        beats: [],
        assets: []
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
          <span className={`text-sm font-mono ${status.includes('healthy') ? 'text-green-600' : 'text-red-600'}`}>
            {status}
          </span>
          <button className="hover:text-blue-600 transition-colors">App</button>
          <button className="hover:text-blue-600 transition-colors">Playground</button>
          <button className="hover:text-blue-600 transition-colors">Settings</button>
        </nav>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 p-8 overflow-y-auto bg-gray-50">
          {currentProject ? (
            <>
              <h2 className="text-2xl font-bold mb-4">{currentProject.name}</h2>
              <StoryStage />
            </>
          ) : (
            <ProjectLibrary />
          )}
        </main>

        {/* Right Sidebar (The Flow) */}
        <aside className="w-64 border-l bg-white p-4 flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">The Flow</h3>
          <nav className="flex flex-col gap-2">
            <button className="p-2 rounded hover:bg-blue-100 transition-colors border border-transparent hover:border-blue-300">1. Story</button>
            <button className="p-2 rounded hover:bg-blue-100 transition-colors border border-transparent hover:border-blue-300">2. Script</button>
            <button className="p-2 rounded hover:bg-blue-100 transition-color border border-transparent hover:border-blue-300">3. Assets</button>
            <button className="p-2 rounded hover:bg-blue-100 transition-colors border border-transparent hover:border-blue-300">4. Shot List</button>
            <button className="p-2 rounded hover:bg-blue-100 transition-colors border border-transparent hover:border-blue-300">5. Final Video</button>
          </nav>
        </aside>
      </div>
    </div>
  );
};

export default Studio;