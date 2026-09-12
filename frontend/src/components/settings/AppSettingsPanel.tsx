import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const APP_ACTIONS = [
  'Develop Raw Story',
  'Extract Cast',
  'Generate Script',
  'Refine Dialog',
  'Generate Shots',
];

const AppSettingsPanel = () => {
  const { backend } = useSettingsStore();
  const [mappings, setMappings] = useState<Record<string, string | null>>({});
  const [prompts, setPrompts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const baseUrl = backend.apiUrl;
    Promise.all([
      fetch(`${baseUrl}/appsettings/`).then(r => r.json()),
      fetch(`${baseUrl}/systemprompts/`).then(r => r.json()),
    ])
      .then(([m, p]) => {
        setPrompts(p);
        const validIds = new Set(p.map((x) => x.id));
        const cleaned: Record<string, string | null> = {};
        for (const [action, file] of Object.entries(m)) {
          cleaned[action] = file && validIds.has(file) ? file : null;
        }
        setMappings(cleaned);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [backend.apiUrl]);

  const handleSave = async () => {
    const baseUrl = backend.apiUrl;
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all(
        Object.entries(mappings).map(([action, promptFile]) =>
          fetch(`${baseUrl}/appsettings/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, promptFile }),
          })
        )
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save mappings:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">App Settings</h2>
        <p className="text-gray-600">Map system prompts to app actions. Leave as "None" to use default behavior.</p>
      </div>

      <div className="space-y-4">
        {APP_ACTIONS.map((action) => (
          <div key={action} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
            <span className="font-medium text-gray-800">{action}</span>
            <select
              value={mappings[action] || ''}
              onChange={(e) => setMappings(prev => ({ ...prev, [action]: e.target.value || null }))}
              className="p-2 border rounded bg-white text-sm max-w-xs"
            >
              <option value="">None</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Mappings'}
        </button>
        {saved && <span className="text-green-600 text-sm">Saved!</span>}
      </div>
    </div>
  );
};

export default AppSettingsPanel;
