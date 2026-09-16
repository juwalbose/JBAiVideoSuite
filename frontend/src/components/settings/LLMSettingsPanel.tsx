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
  const { llm, setLLM, saveLLM, availableModels, setAvailableModels, backend } = useSettingsStore();
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    setSaveError('');
    try {
      await saveLLM();
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const runLLMTest = async () => {
    setIsTesting(true);
    setTestStatus('Testing...');
    try {
      const response = await fetch(`${backend.apiUrl}/llm-test`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.status === 'unhealthy') {
        setTestStatus(`🔴 ${data.details || 'Connection failed'}`);
        setAvailableModels([]);
      } else if (data.status === 'no_models') {
        setTestStatus('🔵 No Models Loaded');
        setAvailableModels([]);
      } else {
        const modelList = data.models || [];
        setAvailableModels(modelList);
        setTestStatus('🟢 Healthy');
      }
    } catch (error) {
      console.error('LLM Test Error:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        setTestStatus('🔴 Unreachable (Check IP/Port or if LM Studio is open)');
      } else {
        setTestStatus(`🔴 Error: ${(error as Error).message}`);
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">LLM Settings</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-muted-foreground">IP Address</label>
          <input
            type="text"
            className="border border-border p-2 rounded w-full bg-card text-foreground"
            value={llm.ip}
            onChange={(e) => setLLM({ ip: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground">Port</label>
          <input
            type="number"
            className="border border-border p-2 rounded w-full bg-card text-foreground"
            value={llm.port}
            onChange={(e) => setLLM({ port: parseInt(e.target.value) })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground">Model Name</label>
          <input
            type="text"
            className="border border-border p-2 rounded w-full bg-card text-foreground"
            value={llm.modelName}
            onChange={(e) => setLLM({ modelName: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground">Temperature</label>
          <input
            type="number"
            step="0.1"
            className="border border-border p-2 rounded w-full bg-card text-foreground"
            value={llm.temperature}
            onChange={(e) => setLLM({ temperature: parseFloat(e.target.value) })}
          />
        </div>
      </div>
      <div className="mb-6">
        <button
          onClick={runLLMTest}
          disabled={isTesting}
          className={`px-4 py-2 rounded transition-colors ${isTesting ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground hover:opacity-90'}`}
        >
          {isTesting ? 'Testing...' : 'Test Connection & List Models'}
        </button>
        {testStatus && (
          <p className="mt-2 font-mono text-sm text-foreground">{testStatus}</p>
        )}
      </div>
      {availableModels.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground mb-2">Available Models:</h3>
          <ul className="list-disc ml-5 text-sm text-muted-foreground">
            {availableModels.map((m, i) => (
              <li key={i}>
                {typeof m === 'object' ? (m.id || m.name || m.object?.name || JSON.stringify(m)) : m}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-8 pt-4 border-t border-border">
        <button
          onClick={handleSave}
          className="bg-success text-white px-6 py-2 rounded hover:opacity-90 transition-colors"
        >
          Save LLM Settings
        </button>
        {saveError && (
          <p className="mt-2 text-sm text-destructive">{saveError}</p>
        )}
      </div>
    </div>
  );
};

export default LLMSettingsPanel;
