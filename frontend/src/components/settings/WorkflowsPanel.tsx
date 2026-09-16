import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const WorkflowsPanel: React.FC = () => {
  const { workflows, setWorkflows, backend } = useSettingsStore();
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  const fetchWorkflows = async () => {
    try {
      const response = await fetch(`${backend.apiUrl}/workflows/`);
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data);
      }
    } catch (error) {
      console.error('Error fetching workflows:', error);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [setWorkflows, backend.apiUrl]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result as string;
      const baseUrl = backend.apiUrl.endsWith('/') ? backend.apiUrl.slice(0, -1) : backend.apiUrl;
      try {
        const res = await fetch(`${baseUrl}/workflows/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name.replace('.json', ''), json_content: content }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ details: res.statusText }));
          alert(`Workflow upload failed: ${err.details || res.statusText}`);
          return;
        }
        await fetchWorkflows();
      } catch (err) {
        console.error('Workflow upload error:', err);
        alert('Workflow upload failed. Check backend connection.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">ComfyUI Workflows</h2>
        <button
          onClick={fetchWorkflows}
          className="px-3 py-1 text-xs bg-muted text-muted-foreground border border-border rounded hover:bg-muted/80 transition-colors"
        >
          Refresh
        </button>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-muted-foreground">Add New Workflow JSON:</label>
        <input type="file" accept=".json" id="workflow-file-input" className="hidden" onChange={handleFileUpload} />
        <button type="button" onClick={() => document.getElementById('workflow-file-input')?.click()}
          className="mt-1 w-full p-3 border-2 border-dashed border-accent/40 rounded text-sm text-accent hover:bg-accent-soft hover:border-accent/60">
          📂 Choose .json File...
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {workflows.length > 0 ? (
          workflows.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedWorkflow(w.id)}
              className={`p-4 border rounded text-left transition-colors ${selectedWorkflow === w.id ? 'bg-accent-soft border-accent/40 text-accent' : 'border-border bg-card text-foreground hover:bg-muted'}`}
            >
              <span className="font-bold">{w.name}</span>
            </button>
          ))
        ) : (
          <p className="text-muted-foreground italic">No workflows found in assets/workflows/</p>
        )}
      </div>
    </div>
  );
};

export default WorkflowsPanel;
