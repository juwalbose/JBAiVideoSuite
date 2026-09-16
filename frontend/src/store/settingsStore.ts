import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch } from '../lib/apiFetch';

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
  taskTTL: number;
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
  availableModels: any[];
  
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
  testComfyuiConnection: () => Promise<string>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      llm: {
        ip: '192.168.1.66',
        port: 1234,
        modelName: 'gemma-4-e4b-uncensored-hauhaucs-aggressive',
        temperature: 0.7,
        maxTokens: 20000,
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
        taskTTL: 600,
      },
      workflows: [],
      availableModels: [],

      setLLM: (settings) => set((state) => ({ llm: { ...state.llm, ...settings } })),
      setBackend: (settings) => set((state) => ({ backend: { ...state.backend, ...settings } })),
      setComfyUI: (settings) => set((state) => ({ comfyui: { ...state.comfyui, ...settings } })),
      addWorkflow: (workflow) => set((state) => ({ workflows: [...state.workflows, workflow] })),
      setWorkflows: (workflows) => set({ workflows }),
      setAvailableModels: (models) => set({ availableModels: models }),

      testComfyuiConnection: async (): Promise<string> => {
        const state = get();
        try {
          const response = await fetch(`${state.backend.apiUrl}/comfyui/check?host=${state.comfyui.ip}&port=${state.comfyui.port}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data: { details: string } = await response.json();
          return data.details;
        } catch (error) {
          return `🔴 Unreachable (${(error as Error).message})`;
        }
      },

      saveLLM: async () => {
        const state = get();
        await apiFetch(`${state.backend.apiUrl}/settings/save-llm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.llm),
        });
      },
      saveBackend: async () => {
        const state = get();
        await apiFetch(`${state.backend.apiUrl}/settings/save-backend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.backend),
        });
      },
      saveComfyUI: async () => {
        const state = get();
        await apiFetch(`${state.backend.apiUrl}/settings/save-comfyui`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.comfyui),
        });
      },

      loadSettings: async () => {
        try {
          const state = get();
          const response = await fetch(`${state.backend.apiUrl}/settings/`);
          if (response.ok) {
            const data = await response.json();
            set((state) => ({
              llm: { ...state.llm, ...data.llm },
              backend: { ...state.backend, ...data.backend },
              comfyui: { ...state.comfyui, ...data.comfyui },
            }));
          }
        } catch (error) {
          console.error("Error loading settings from DB:", error);
        }
      },
    }),
    { name: 'app-settings' }
  )
);
