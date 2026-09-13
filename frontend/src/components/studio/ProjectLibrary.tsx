import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { Folder } from 'lucide-react';
import NewProjectModal from './NewProjectModal';

const ProjectLibrary = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const { projects, currentProject, setCurrentProject, fetchProjects, deleteAllProjects } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, []);

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
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                <span className="text-gray-300 text-xs uppercase tracking-wider">No Preview</span>
              </div>
              <h3 className="text-xl font-bold mb-1">{project.name || 'Untitled Project'}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                project.type === 'episodic'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {project.type === 'episodic' ? 'Episodic' : 'Single Video'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 flex justify-center">
        <button 
          className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-colors shadow-lg"
          onClick={() => setModalOpen(true)}
        >
          + New Project
        </button>
      </div>

      <NewProjectModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </div>
  );
};

export default ProjectLibrary;