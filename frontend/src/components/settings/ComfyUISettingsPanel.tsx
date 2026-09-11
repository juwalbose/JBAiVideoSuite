import React from 'react';
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

  const handleTest = async () => {
    setIsTesting(true);
    const status = await testComfyuiConnection();
    setTestStatus(status);
    setIsTesting(false);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">ComfyUI Settings</h2>
      <div className="grid grid-cols-4 gap-4 mb-8">
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
        <div>
          <label className="block text-sm font-medium">Poll Interval (ms)</label>
          <input
            type="number"
            className="border p-2 rounded w-full"
            value={comfyui.pollInterval}
            onChange={(e) => setComfyUI({ pollInterval: parseInt(e.target.value) || 4000 })}
          />
        </div>
      </div>
      <div className="mb-6">
        <button
          onClick={handleTest}
          className={`px-4 py-2 rounded transition-colors ${isTesting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
        >
          {isTesting ? 'Testing...' : 'Test Connection & Status'}
        </button>
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">
            Calling: <span className="font-mono">{comfyui.ip}:{comfyui.port}</span>
          </p>
          {testStatus && (
            <p className="font-mono text-sm">{testStatus}</p>
          )}
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
  );
};

export default ComfyUISettingsPanel;
