import React, { useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface LLMSettingsPanelProps {
  testStatus: string;
  setTestStatus: (s: string) => void;
  isTesting: boolean;
  setIsTesting: (b: boolean) => void;
}

const LLMSettingsPanel: React.FC<LLMSettingsPanelProps> = ({
  testStatus,
  setTestStatus,
  isTesting,
  setIsTesting,
}) => {
  const { llm, setLLM, saveLLM, availableModels, setAvailableModels } = useSettingsStore();

  const runLLMTest = async () => {
    setIsTesting(true);
    setTestStatus('Testing...');
    try {
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
        setTestStatus('🟢 Healthy');
      }
    } catch (error) {
      console.error('LLM Test Error:', error);
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
          onClick={runLLMTest}
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
            {availableModels.map((m, i) => (
              <li key={i}>
                {typeof m === 'object' ? (m.id || m.name || m.object?.name || JSON.stringify(m)) : m}
              </li>
            ))}
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
  );
};

export default LLMSettingsPanel;
