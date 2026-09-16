import React, { useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const BackendSettingsPanel: React.FC = () => {
  const { backend, setBackend, saveBackend } = useSettingsStore();
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    setSaveError('');
    try {
      await saveBackend();
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Backend Settings</h2>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-muted-foreground">API URL</label>
          <input
            type="text"
            className="border border-border p-2 rounded w-full bg-card text-foreground"
            value={backend.apiUrl}
            onChange={(e) => setBackend({ apiUrl: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground">Database Path</label>
          <input
            type="text"
            className="border border-border p-2 rounded w-full bg-card text-foreground"
            value={backend.dbPath}
            onChange={(e) => setBackend({ dbPath: e.target.value })}
          />
        </div>
      </div>
      <div className="mt-8 pt-4 border-t border-border">
        <button
          onClick={handleSave}
          className="bg-success text-white px-6 py-2 rounded hover:opacity-90 transition-colors"
        >
          Save Backend Settings
        </button>
        {saveError && (
          <p className="mt-2 text-sm text-destructive">{saveError}</p>
        )}
      </div>
    </div>
  );
};

export default BackendSettingsPanel;
