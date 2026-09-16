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
      await fetch(`${baseUrl}/systemprompts/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name.replace(/\.txt$/, ''), content }),
      });
      await fetchPrompts();
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">System Prompts</h2>
        <button
          onClick={fetchPrompts}
          className="px-3 py-1 text-xs bg-muted text-muted-foreground border border-border rounded hover:bg-muted/80 transition-colors"
        >
          Refresh
        </button>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-muted-foreground">Add New System Prompt (.txt):</label>
        <input type="file" accept=".txt" id="sysprompt-file-input" className="hidden" onChange={handleFileUpload} />
        <button type="button" onClick={() => document.getElementById('sysprompt-file-input')?.click()}
          className="mt-1 w-full p-3 border-2 border-dashed border-accent/40 rounded text-sm text-accent hover:bg-accent-soft hover:border-accent/60">
          📂 Choose .txt File...
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {prompts.length > 0 ? (
          prompts.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPrompt(p.id)}
              className={`p-4 border rounded text-left transition-colors ${selectedPrompt === p.id ? 'bg-accent-soft border-accent/40 text-accent' : 'border-border bg-card text-foreground hover:bg-muted'}`}
            >
              <span className="font-bold">{p.name}</span>
            </button>
          ))
        ) : (
          <p className="text-muted-foreground italic">No system prompts found in assets/systemprompts/</p>
        )}
      </div>
    </div>
  );
};

export default SystemPromptsPanel;
