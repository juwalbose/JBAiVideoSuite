import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LLMSettings {
  ip: string;
  port: number;
  modelName: string;
  temperature: number;
  maxTokens: number;
}

export interface BackendSettings {
  apiUrl: string;
  dbPath: string;
}

export interface ComfyUISettings {
  ip: string;
  port: number;
  deviceId: string;
  pollInterval: number;
}

export interface Workflow {
  id: string;
  name: string;
  json: any;
}

export interface SettingsState {
  llm: LLMSettings;
  backend: BackendSettings;
  comfyui: ComfyUISettings;
  workflows: Workflow[];
  availableModels: string[];
  
  setLLM: (settings: Partial<LLMSettings>) => void;
  setBackend: (settings: Partial<BackendSettings>) => void;
  setComfyUI: (settings: Partial<ComfyUISettings>) => void;
  addWorkflow: (workflow: Workflow) => void;
  setWorkflows: (workflows: Workflow[]) => void;
  setAvailableModels: (models: string[]) => void;

  saveLLM: () => Promise<void>;
  saveBackend: () => Promise<void>;
  saveComfyUI: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      llm: {
        ip: '192.168.1.66',
        port: 1234,
        modelName: 'gemma-4-e4b-uncensored-hauhaucs-aggressive',
        temperature: 0.7,
        maxTokens: 512,
      },
      backend: {
        apiUrl: 'http://127.0.0.1:8000',
        dbPath: 'backend/prisma/database.db',
      },
      comfyui: {
        ip: '127.0.0.1',
        port: 8188,
        deviceId: '0',
        pollInterval: 4000,
      },
      workflows: [],
      availableModels: [],

      setLLM: (settings) => set((state) => ({ llm: { ...state.llm, ...settings } })),
      setBackend: (settings) => set((state) => ({ backend: { ...state.backend, ...settings } })),
      setComfyUI: (settings) => set((state) => ({ comfyui: { ...state.comfyui, ...settings } })),
      addWorkflow: (workflow) => set((state) => ({ workflows: [...state.workflows, workflow] })),
      setWorkflows: (workflows) => set({ workflows }),
      setAvailableModels: (models) => set({ availableModels: models }),

      testComfyuiConnection: async () => {
        const state = useSettingsStore.getState();
        try {
          // Call the new /check route using the dynamic IP and Port from settings as query parameters
          const response = await fetch(`${state.backend.apiUrl}/comfyui/check?host=${state.comfyui.ip}&port=${state.comfyui.port}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          return data.details;
        } catch (error) {
          return `🔴 Unreachable (${error.message})`;
        }
      },

      saveLLM: async () => {
        const state = useSettingsStore.getState();
        await fetch('http://127.0.0.1:8000/settings/save-llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.llm),
        });
      },
      saveBackend: async () => {
        const state = useSettingsStore.getState();
        await fetch('http://127.0.0.1:8000/settings/save-backend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.backend),
        });
      },
      saveComfyUI: async () => {
        const state = useSettingsStore.getState();
        await fetch('http://127.0.0.1:8000/settings/save-comfyui', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.comfyui),
        });
      },

      loadSettings: async () => {
        try {
          const response = await fetch('http://127.0.0.1:8000/settings/');
          if (response.ok) {
            const data = await response.json();
            set({
              llm: data.llm,
              backend: data.backend,
              comfyui: data.comfyui,
            });
          }
        } catch (error) {
          console.error("Error loading settings from DB:", error);
        }
      },
    }),
    { name: 'app-settings' }
  )
);
