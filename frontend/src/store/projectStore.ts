import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';

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
  order: number;
  shots: Shot[];
  assets: any[];
}

export interface Story {
  id: string;
  narrativeArc: string;
  rawInput?: string;
}

export interface Script {
  id: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  type: 'single' | 'episodic';
  duration: number;
  episodeCount: number;
  story?: Story;
  script?: Script;
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
  setCurrentProject: (project: Project | null) => void;
  fetchProjects: () => Promise<void>;
  deleteAllProjects: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (name: string, duration?: number, episodeCount?: number) => Promise<void>;
  updateStory: (narrativeArc: string, rawInput?: string, episode?: number) => Promise<void>;
  addBeat: (content: string) => void;
  removeBeat: (beatId: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,

  setProjects: (newProject) => set((state) => { 
    return { projects: state.projects.length === 0 ? [newProject] : [...state.projects, newProject] };
  }),
  addProject: (newProject) => set((state) => ({ 
    projects: [...state.projects, newProject] 
  })),
  setCurrentProject: (project) => set({ currentProject: project }),
  
  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      set({ projects: data, isLoading: false });
    } catch (error) {
      console.error("Error fetching projects:", error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  deleteAllProjects: async () => {
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/delete-all`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete all projects');
      set({ projects: [] });
    } catch (error) {
      console.error("Error deleting all projects:", error);
      set({ error: (error as Error).message });
    }
  },

  deleteProject: async (id: string) => {
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete project');
      set((state) => ({
        projects: state.projects.filter(p => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject
      }));
    } catch (error) {
      console.error("Error deleting project:", error);
      set({ error: (error as Error).message });
    }
  },

  updateProject: async (name: string, duration?: number, episodeCount?: number) => {
    const project = get().currentProject;
    if (!project) return;
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const body: Record<string, any> = { name };
      if (duration !== undefined) body.duration = duration;
      if (episodeCount !== undefined) body.episodeCount = episodeCount;
      const response = await fetch(`${baseUrl}/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error('Failed to update project');
    } catch (error) {
      console.error("Error updating project:", error);
    }
  },

  updateStory: async (narrativeArc: string, rawInput?: string, episode?: number) => {
    const project = get().currentProject;
    if (!project || !project.story) return;
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const epParam = episode ? `?episode=${episode}` : '';
      const response = await fetch(`${baseUrl}/projects/${project.id}/story${epParam}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrativeArc, rawInput })
      });
      if (!response.ok) throw new Error('Failed to update story');
      const data = await response.json();

      set((state) => {
        const cp = state.currentProject;
        if (!cp || !cp.story) return state;
        return {
          currentProject: {
            ...cp,
            story: {
              ...cp.story,
              narrativeArc: data.data?.narrativeArc || data.narrative_arc || data.narrativeArc,
              rawInput: rawInput !== undefined ? rawInput : cp.story.rawInput
            }
          }
        };
      });
    } catch (error) {
      console.error("Error updating story:", error);
    }
  },

  addBeat: (content: string) => {
    const project = get().currentProject;
    if (!project) return;
    const newBeat: Beat = {
      id: Math.random().toString(36).substring(2, 9),
      content,
      order: project.beats.length,
      shots: [],
      assets: []
    };
    set({ currentProject: { ...project, beats: [...project.beats, newBeat] } });
  },

  removeBeat: (beatId: string) => {
    const project = get().currentProject;
    if (!project) return;
    set({ 
      currentProject: { 
        ...project, 
        beats: project.beats.filter(b => b.id !== beatId) 
      } 
    });
  },
}));
