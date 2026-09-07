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
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  setProject: (project: Project) => void;
  updateStory: (narrativeArc: string, rawInput?: string) => void;
  addBeat: (content: string) => void;
  removeBeat: (beatId: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  isLoading: false,
  error: null,

  setProject: (project) => set({ currentProject: project }),
  
  updateStory: (narrativeArc, rawInput) => 
    set((state) => ({
      currentProject: state.currentProject ? {
        ...state.currentProject,
        story: { id: 'temp-id', narrativeArc, rawInput }
      } : null
    })),

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