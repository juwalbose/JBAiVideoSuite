import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';
import { X } from 'lucide-react';

const NewProjectModal = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'single' | 'episodic'>('single');
  const [isCreating, setIsCreating] = useState(false);
  const { projects, addProject } = useProjectStore();

  if (!isOpen) return null;

  const handleCreate = async () => {
    setIsCreating(true);
    console.log("DEBUG: Creating Project with Name:", name, "and Type:", type);
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      });

      if (!response.ok) throw new Error('Failed to create project');
      const data = await response.json();
      console.log("DEBUG: Data received from backend:", data);
      addProject(data); 
      onClose();
    } catch (error) {
      console.error("Error creating project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">New Project</h2>
          <button 
            type="button"
            onClick={() => {
              console.log("DEBUG: Close button clicked");
              onClose();
            }}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input 
              type="text" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              placeholder="e.g., The Mars Explorer"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Video Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="projectType"
                  value="single"
                  checked={type === 'single'}
                  onChange={() => setType('single')}
                  className="accent-blue-600"
                />
                <span className="text-sm">Single Video</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="projectType"
                  value="episodic"
                  checked={type === 'episodic'}
                  onChange={() => setType('episodic')}
                  className="accent-blue-600"
                />
                <span className="text-sm">Episodic</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button 
            type="button"
            onClick={() => {
              console.log("DEBUG: Close button clicked");
              onClose();
            }}
            className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={() => {
              console.log("DEBUG: Create button clicked");
              handleCreate();
            }}
            disabled={!name || isCreating}
            className={`px-6 py-2 bg-blue-600 text-white rounded-lg transition-colors shadow-md active:scale-95 ${isCreating ? 'opacity-50' : ''}`}
          >
            {isCreating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewProjectModal;