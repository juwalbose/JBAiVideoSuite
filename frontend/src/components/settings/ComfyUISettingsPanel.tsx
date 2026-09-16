import React, { useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface ComfyUISettingsPanelProps {
  testStatus: string;
  setTestStatus: (s: string) => void;
  isTesting: boolean;
  setIsTesting: (b: boolean) => void;
}

const ComfyUISettingsPanel: React.FC<ComfyUISettingsPanelProps> = ({
  testStatus,
  setTestStatus,
  isTesting,
  setIsTesting,
}) => {
  const { comfyui, setComfyUI, saveComfyUI, testComfyuiConnection } = useSettingsStore();
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    setSaveError('');
    try {
      await saveComfyUI();
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    const status = await testComfyuiConnection();
    setTestStatus(status);
    setIsTesting(false);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">ComfyUI Settings</h2>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-muted-foreground">IP Address</label>
          <input
            type="text"
            className="border border-border p-2 rounded w-full bg-card text-foreground"
            value={comfyui.ip}
            onChange={(e) => setComfyUI({ ip: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground">Port</label>
          <input
            type="number"
            className="border border-border p-2 rounded w-full bg-card text-foreground"
            value={comfyui.port}
            onChange={(e) => setComfyUI({ port: parseInt(e.target.value) })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground">Device ID</label>
          <input
            type="text"
            className="border border-border p-2 rounded w-full bg-card text-foreground"
            value={comfyui.deviceId}
            onChange={(e) => setComfyUI({ deviceId: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground">Poll Interval (ms)</label>
          <input
            type="number"
            className="border border-border p-2 rounded w-full bg-card text-foreground"
            value={comfyui.pollInterval}
            onChange={(e) => setComfyUI({ pollInterval: parseInt(e.target.value) || 4000 })}
          />
        </div>
      </div>
      <div className="mb-6">
        <button
          onClick={handleTest}
          className={`px-4 py-2 rounded transition-colors ${isTesting ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground hover:opacity-90'}`}
        >
          {isTesting ? 'Testing...' : 'Test Connection & Status'}
        </button>
        <div className="mt-2">
          <p className="text-xs text-muted-foreground mb-1">
            Calling: <span className="font-mono text-foreground">{comfyui.ip}:{comfyui.port}</span>
          </p>
          {testStatus && (
            <p className="font-mono text-sm text-foreground">{testStatus}</p>
          )}
        </div>
      </div>
      <div className="mt-8 pt-4 border-t border-border">
        <button
          onClick={handleSave}
          className="bg-success text-white px-6 py-2 rounded hover:opacity-90 transition-colors"
        >
          Save ComfyUI Settings
        </button>
        {saveError && (
          <p className="mt-2 text-sm text-destructive">{saveError}</p>
        )}
      </div>
    </div>
  );
};

export default ComfyUISettingsPanel;
