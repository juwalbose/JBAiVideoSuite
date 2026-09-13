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
      const content = reader.result;
      const baseUrl = backend.apiUrl.endsWith('/') ? backend.apiUrl.slice(0, -1) : backend.apiUrl;
      const url = `${baseUrl}/workflows/add?name=${file.name.replace('.json', '')}&json_content=${encodeURIComponent(content)}`;
      console.log('Fetching workflow from:', url);
      await fetch(url, { method: 'POST' });
      await fetchWorkflows();
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">ComfyUI Workflows</h2>
        <button
          onClick={fetchWorkflows}
          className="px-3 py-1 text-xs bg-gray-100 border rounded hover:bg-gray-200 transition-colors"
        >
          Refresh
        </button>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium">Add New Workflow JSON:</label>
        <input
          type="file"
          accept=".json"
          className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          onChange={handleFileUpload}
        />
      </div>
      <div className="grid grid-cols-1 gap-2">
        {workflows.length > 0 ? (
          workflows.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedWorkflow(w.id)}
              className={`p-4 border rounded text-left transition-colors ${selectedWorkflow === w.id ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'}`}
            >
              <span className="font-bold">{w.name}</span>
            </button>
          ))
        ) : (
          <p className="text-gray-500 italic">No workflows found in assets/workflows/</p>
        )}
      </div>
    </div>
  );
};

export default WorkflowsPanel;
