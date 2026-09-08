import { create } from 'zustand';

export type AssetType = 'CHARACTER' | 'ENVIRONMENT' | 'PROP';

export interface Shot {
  id: string;
  order: number;
  prompt: string;
  cameraMovement?: string;
  duration?: number;
  videoPath?: string;
}

export interface Beat {
  id: string;
  content: string;
  shots: Shot[];
  assets: any[];
}

export interface Story {
  id: string;
  narrativeArc: string;
  rawInput?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  story?: Story;
  beats: Beat[];
  assets: any[];
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  setProjects: (newProject: Project) => void;
  addProject: (newProject: Project) => void;
  setCurrentProject: (project: Project) => void;
  fetchProjects: () => Promise<void>;
  deleteAllProjects: () => Promise<void>;
  updateProject: (name: string, description?: string) => Promise<void>;
  updateStory: (narrativeArc: string, rawInput?: string) => Promise<void>;
  addBeat: (content: string) => void;
  removeBeat: (beatId: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,

  setProjects: (newProject) => set((state) => ({ 
    projects: state.projects.length === 0 ? [newProject] : [...state.projects, newProject] 
  })),
  addProject: (newProject) => set((state) => ({ 
    projects: [...state.projects, newProject] 
  })),
  setCurrentProject: (project) => set({ currentProject: project }),
  
  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('http://127.0.0.1:8000/projects/');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      set({ projects: data, isLoading: false });
    } catch (error) {
      console.error("Error fetching projects:", error);
      set({ error: error.message, isLoading: false });
    }
  },

  deleteAllProjects: async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/projects/delete-all', {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete all projects');
      set({ projects: [] });
    } catch (error) {
      console.error("Error deleting all projects:", error);
      set({ error: error.message });
    }
  },

  updateProject: async (name: string, description?: string) => {
    if (!get().currentProject) return;
    try {
      const response = await fetch(`http://127.0.0.1:8000/projects/${get().currentProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || "" })
      });
      if (!response.ok) throw new Error('Failed to update project');
      const data = await response.json();
      set((state) => ({
        currentProject: { ...state.currentProject, name: data.name, description: data.description }
      }));
    } catch (error) {
      console.error("Error updating project:", error);
    }
  },

  updateStory: async (narrativeArc: string, rawInput?: string) => {
    if (!get().currentProject) return;
    try {
      const response = await fetch(`http://127.0.0.1:8000/projects/${get().currentProject.id}/story`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          narrative_arc: narrativeArc, 
          original_idea: rawInput 
        })
      });
      if (!response.ok) throw new Error('Failed to update story');
      const data = await response.json();
      set((state) => ({
        currentProject: state.currentProject ? {
          ...state.currentProject,
          story: { id: data.id, narrativeArc: data.narrative_arc, rawInput: data.raw_input }
        } : null
      }));
    } catch (error) {
      console.error("Error updating story:", error);
    }
  },

  addBeat: (content) => set((state) => ({
    currentProject: state.currentProject ? {
      ...state.currentProject,
      beats: [...state.currentProject.beats, { id: 'temp-id', content, shots: [] }]
    } : null
  })),

  removeBeat: (beatId) => set((state) => ({
    currentProject: state.currentProject ? {
      ...state.currentProject,
      beats: state.currentProject.beats.filter(b => b.id !== beatId)
    } : null
  })),
}));
