import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('llm');
  const [testStatus, setTestStatus] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const { llm, backend, comfyui, workflows, setLLM, setBackend, setComfyUI, addWorkflow, availableModels, setAvailableModels, saveLLM, saveBackend, saveComfyUI, loadSettings } = useSettingsStore();

  const testLLMConnection = async () => {
    setIsTesting(true);
    setTestStatus('Testing...');
    try {
      // Call the backend proxy instead of LM Studio directly to avoid CORS issues
      const response = await fetch('http://127.0.0.1:8000/llm-test');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const modelList = data.models || [];
      
      if (modelList.length === 0) {
        setTestStatus('🔵 No Models Loaded');
        setAvailableModels([]);
      } else {
        setAvailableModels(modelList);
        setTestStatus(`🟢 Healthy: ${modelList[0]} (and ${modelList.length - 1} more)`);
      }
    } catch (error) {
      console.error("LLM Test Error:", error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        setTestStatus('🔴 Unreachable (Check IP/Port or if LM Studio is open)');
      } else {
        setTestStatus(`🔴 Error: ${error.message}`);
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-white">
      {/* Left Navigation for Settings */}
      <aside className="w-64 border-r p-4 flex flex-col gap-4 bg-gray-50">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Settings</h3>
        <nav className="flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('llm')}
            className={`p-2 rounded ${activeTab === 'llm' ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'}`}
          >
            LLM Settings
          </button>
          <button 
            onClick={() => setActiveTab('backend')}
            className={`p-2 rounded ${activeTab === 'backend' ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'}`}
          >
            Backend Settings
          </button>
          <button 
            onClick={() => setActiveTab('comfyui')}
            className={`p-2 rounded ${activeTab === 'comfyui' ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'}`}
          >
            ComfyUI Settings
          </button>
          <button 
            onClick={() => setActiveTab('workflows')}
            className={`p-2 rounded ${activeTab === 'workflows' ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'}`}
          >
            ComfyUI Workflows
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'llm' && (
          <div>
            <h2 className="text-xl font-bold mb-4">LLM Settings</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium">IP Address</label>
                <input 
                  type="text" 
                  className="border p-2 rounded w-full" 
                  value={llm.ip} 
                  onChange={(e) => setLLM({ ip: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Port</label>
                <input 
                  type="number" 
                  className="border p-2 rounded w-full" 
                  value={llm.port} 
                  onChange={(e) => setLLM({ port: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Model Name</label>
                <input 
                  type="text" 
                  className="border p-2 rounded w-full" 
                  value={llm.modelName} 
                  onChange={(e) => setLLM({ modelName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Temperature</label>
                <input 
                  type="number" 
                  step="0.1"
                  className="border p-2 rounded w-full" 
                  value={llm.temperature} 
                  onChange={(e) => setLLM({ temperature: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="mb-6">
              <button 
                onClick={testLLMConnection}
                disabled={isTesting}
                className={`px-4 py-2 rounded transition-colors ${isTesting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
              >
                {isTesting ? 'Testing...' : 'Test Connection & List Models'}
              </button>
              {testStatus && (
                <p className="mt-2 font-mono text-sm">{testStatus}</p>
              )}
            </div>
            {availableModels.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-2">Available Models:</h3>
                <ul className="list-disc ml-5 text-sm">
                  {availableModels.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
            <div className="mt-8 pt-4 border-t">
              <button 
                onClick={saveLLM}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition-colors"
              >
                Save LLM Settings
              </button>
            </div>
          </div>
        )}

        {activeTab === 'backend' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Backend Settings</h2>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div>
                <label className="block text-sm font-medium">API URL</label>
                <input 
                  type="text" 
                  className="border p-2 rounded w-full" 
                  value={backend.apiUrl} 
                  onChange={(e) => setBackend({ apiUrl: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Database Path</label>
                <input 
                  type="text" 
                  className="border p-2 rounded w-full" 
                  value={backend.dbPath} 
                  onChange={(e) => setBackend({ dbPath: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-8 pt-4 border-t">
              <button 
                onClick={saveBackend}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition-colors"
              >
                Save Backend Settings
              </button>
            </div>
          </div>
        )}

        {activeTab === 'comfyui' && (
          <div>
            <h2 className="text-xl font-bold mb-4">ComfyUI Settings</h2>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div>
                <label className="block text-sm font-medium">IP Address</label>
                <input 
                  type="text" 
                  className="border p-2 rounded w-full" 
                  value={comfyui.ip} 
                  onChange={(e) => setComfyUI({ ip: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Port</label>
                <input 
                  type="number" 
                  className="border p-2 rounded w-full" 
                  value={comfyui.port} 
                  onChange={(e) => setComfyUI({ port: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Device ID</label>
                <input 
                  type="text" 
                  className="border p-2 rounded w-full" 
                  value={comfyui.deviceId} 
                  onChange={(e) => setComfyUI({ deviceId: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-8 pt-4 border-t">
              <button 
                onClick={saveComfyUI}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition-colors"
              >
                Save ComfyUI Settings
              </button>
            </div>
          </div>
        )}

        {activeTab === 'workflows' && (
          <div>
            <h2 className="text-xl font-bold mb-4">ComfyUI Workflows</h2>
            <div className="mb-4">
              <button 
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                onClick={() => {
                  const newWorkflow = { id: Date.now().toString(), name: 'New Workflow', json: {} };
                  addWorkflow(newWorkflow);
                }}
              >
                Add Sample Workflow
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {workflows.map((w) => (
                <div key={w.id} className="p-4 border rounded bg-gray-50">
                  <span className="font-bold">{w.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Settings;
