import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface PromptItem {
  id: string;
  name: string;
}

const SystemPromptsPanel: React.FC = () => {
  const { backend } = useSettingsStore();
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  const fetchPrompts = async () => {
    try {
      const response = await fetch(`${backend.apiUrl}/systemprompts/`);
      if (response.ok) {
        const data = await response.json();
        setPrompts(data);
      }
    } catch (error) {
      console.error('Error fetching system prompts:', error);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, [backend.apiUrl]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result as string;
      const baseUrl = backend.apiUrl.endsWith('/') ? backend.apiUrl.slice(0, -1) : backend.apiUrl;
      const url = `${baseUrl}/systemprompts/add?name=${file.name.replace('.txt', '')}&content=${encodeURIComponent(content)}`;
      console.log('Adding system prompt:', url);
      await fetch(url, { method: 'POST' });
      await fetchPrompts();
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">System Prompts</h2>
        <button
          onClick={fetchPrompts}
          className="px-3 py-1 text-xs bg-gray-100 border rounded hover:bg-gray-200 transition-colors"
        >
          Refresh
        </button>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium">Add New System Prompt (.txt):</label>
        <input type="file" accept=".txt" id="sysprompt-file-input" className="hidden" onChange={handleFileUpload} />
        <button type="button" onClick={() => document.getElementById('sysprompt-file-input')?.click()}
          className="mt-1 w-full p-3 border-2 border-dashed border-blue-300 rounded text-sm text-blue-600 hover:bg-blue-50 hover:border-blue-400">
          📂 Choose .txt File...
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {prompts.length > 0 ? (
          prompts.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPrompt(p.id)}
              className={`p-4 border rounded text-left transition-colors ${selectedPrompt === p.id ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'}`}
            >
              <span className="font-bold">{p.name}</span>
            </button>
          ))
        ) : (
          <p className="text-gray-500 italic">No system prompts found in assets/systemprompts/</p>
        )}
      </div>
    </div>
  );
};

export default SystemPromptsPanel;
