import React, { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';
import { Folder, Download } from 'lucide-react';
import NewProjectModal from './NewProjectModal';

const ProjectLibrary = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const { projects, currentProject, setCurrentProject, fetchProjects, deleteAllProjects } = useProjectStore();
  const baseUrl = useSettingsStore.getState().backend.apiUrl;
  const [coverImages, setCoverImages] = useState<Record<string, string | null>>({});
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportProjectId, setExportProjectId] = useState<string | null>(null);
  const [exportProjectName, setExportProjectName] = useState('');
  const [exportFilename, setExportFilename] = useState('');
  const [includeSettings, setIncludeSettings] = useState(true);
  const [exporting, setExporting] = useState(false);

  const openExportModal = (projectId: string, projectName: string) => {
    setExportProjectId(projectId);
    setExportProjectName(projectName);
    setExportFilename(`${projectName.replace(/\s+/g, '_')}_export.json`);
    setIncludeSettings(true);
    setExportModalOpen(true);
  };

  const handleExport = async () => {
    if (!exportProjectId) return;
    setExporting(true);
    try {
      const res = await fetch(`${baseUrl}/export/project/${exportProjectId}?include_settings=${includeSettings}`);
      const data = await res.json();
      if (data.status === 'error') {
        alert(data.details);
        return;
      }
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename || 'export.json';
      a.click();
      URL.revokeObjectURL(url);
      setExportModalOpen(false);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed. Check backend connection.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch(`${baseUrl}/export/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.status === 'error') {
        alert(result.details);
        return;
      }
      await fetchProjects();
      alert('Project imported successfully!');
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed. Is the file a valid export?');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (projects.length === 0) return;
    const fetchCovers = async () => {
      const newCovers: Record<string, string | null> = {};
      for (const project of projects) {
        try {
          const res = await fetch(`${baseUrl}/projects/${project.id}/assets`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
              const chars = data.assets?.characters || [];
              const firstChar = chars[0];
              const firstState = firstChar?.states?.[0];
              const imgPath = firstState?.characterSheet || firstState?.imagePath;
              newCovers[project.id] = imgPath ? `${baseUrl}${imgPath}` : null;
            } else {
              newCovers[project.id] = null;
            }
          } else {
            newCovers[project.id] = null;
          }
        } catch {
          newCovers[project.id] = null;
        }
      }
      setCoverImages(newCovers);
    };
    fetchCovers();
  }, [projects]);

  return (
    <div className="p-8">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold mb-2">Your Projects</h1>
          <p className="text-gray-600">Select a project to start your production journey.</p>
        </div>
        {projects.length > 0 && (
          <button 
            onClick={() => {
              if (window.confirm("Do you want to remove all projects?")) {
                deleteAllProjects();
              }
            }}
            className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors shadow"
          >
            Delete All
          </button>
        )}
      </header>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-xl bg-gray-50 p-8">
          <Folder size={48} className="text-gray-300 mb-4" />
          <p className="text-gray-500">No projects yet. Click the button below to create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <div 
              key={`${project.id}-${index}`}
              onClick={() => setCurrentProject(project)}
              className={`p-6 rounded-xl border cursor-pointer transition-all hover:shadow-lg ${
                currentProject?.id === project.id ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                {coverImages[project.id] ? (
                  <img
                    src={coverImages[project.id]!}
                    alt={project.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement!.classList.add('flex', 'items-center', 'justify-center');
                      const span = document.createElement('span');
                      span.className = 'text-gray-300 text-xs uppercase tracking-wider';
                      span.textContent = 'No Preview';
                      (e.target as HTMLImageElement).parentElement!.appendChild(span);
                    }}
                  />
                ) : (
                  <span className="text-gray-300 text-xs uppercase tracking-wider">No Preview</span>
                )}
              </div>
              <h3 className="text-xl font-bold mb-1">{project.name || 'Untitled Project'}</h3>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  project.type === 'episodic'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {project.type === 'episodic' ? 'Episodic' : 'Single Video'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openExportModal(project.id, project.name || 'Untitled Project');
                  }}
                  className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                  title="Export this project"
                >
                  <Download size={14} />
                  Export
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 flex justify-center gap-4">
        <button
          className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-colors shadow-lg"
          onClick={() => setModalOpen(true)}
        >
          + New Project
        </button>
        <button
          className="px-6 py-3 bg-gray-600 text-white rounded-full font-bold hover:bg-gray-700 transition-colors shadow-lg"
          onClick={handleImport}
          disabled={importing}
        >
          {importing ? 'Importing...' : 'Import Project'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <NewProjectModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />

      {exportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setExportModalOpen(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Export Project</h2>
            <p className="text-sm text-gray-500 mb-4">
              Exporting <span className="font-semibold text-gray-700">{exportProjectName}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filename</label>
              <input
                type="text"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <label className="flex items-center gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSettings}
                onChange={(e) => setIncludeSettings(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Include settings &amp; mappings</span>
            </label>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setExportModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {exporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-16 pb-4 text-center text-xs text-gray-400">
        Created by Juwal Bose for{' '}
        <a href="https://youtube.com/@visualfictions" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          Visual Fictions
        </a>
      </footer>
    </div>
  );
};

export default ProjectLibrary;
