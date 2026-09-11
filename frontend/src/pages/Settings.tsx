import React, { useState } from 'react';
import LLMSettingsPanel from '../components/settings/LLMSettingsPanel';
import BackendSettingsPanel from '../components/settings/BackendSettingsPanel';
import ComfyUISettingsPanel from '../components/settings/ComfyUISettingsPanel';
import WorkflowsPanel from '../components/settings/WorkflowsPanel';

const TABS = [
  { id: 'llm', label: 'LLM Settings' },
  { id: 'backend', label: 'Backend Settings' },
  { id: 'comfyui', label: 'ComfyUI Settings' },
  { id: 'workflows', label: 'ComfyUI Workflows' },
] as const;

const Settings = () => {
  const [activeTab, setActiveTab] = useState<string>('llm');
  const [testStatus, setTestStatus] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const renderPanel = () => {
    switch (activeTab) {
      case 'llm':
        return (
          <LLMSettingsPanel
            testStatus={testStatus}
            setTestStatus={setTestStatus}
            isTesting={isTesting}
            setIsTesting={setIsTesting}
          />
        );
      case 'backend':
        return <BackendSettingsPanel />;
      case 'comfyui':
        return (
          <ComfyUISettingsPanel
            testStatus={testStatus}
            setTestStatus={setTestStatus}
            isTesting={isTesting}
            setIsTesting={setIsTesting}
          />
        );
      case 'workflows':
        return <WorkflowsPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full w-full bg-white">
      <aside className="w-64 border-r p-4 flex flex-col gap-4 bg-gray-50">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Settings</h3>
        <nav className="flex flex-col gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`p-2 rounded ${activeTab === tab.id ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        {renderPanel()}
      </main>
    </div>
  );
};

export default Settings;
