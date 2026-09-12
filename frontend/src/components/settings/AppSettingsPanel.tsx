import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const APP_ACTIONS = [
  'Develop Raw Story',
  'Extract Cast',
  'Generate Script',
  'Refine Dialog',
  'Generate Shots',
];

const ASSET_JSON_FORMAT = `{
  "characters": [
    {
      "name": "Character Name",
      "description": "Physical description, personality, role in story",
      "states": [
        {
          "name": "State Name (e.g. 'Injured')",
          "description": "Description of this specific state",
          "scenes": ["Scene 1", "Scene 3"]
        }
      ]
    }
  ],
  "locations": [
    {
      "name": "Location Name",
      "description": "Visual description of the environment",
      "states": [
        {
          "name": "State Name (e.g. 'Day', 'Night')",
          "description": "Description of this state",
          "scenes": ["Scene 1"]
        }
      ]
    }
  ],
  "props": [
    {
      "name": "Prop Name",
      "description": "What the prop looks like",
      "associatedCharacters": ["Character Name"],
      "scenes": ["Scene 2"]
    }
  ]
}`;

const AppSettingsPanel = () => {
  const { backend } = useSettingsStore();
  const [mappings, setMappings] = useState<Record<string, string | null>>({});
  const [prompts, setPrompts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showJsonFormat, setShowJsonFormat] = useState(false);

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

      <div className="border-t pt-4">
        <button
          onClick={() => setShowJsonFormat(!showJsonFormat)}
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          {showJsonFormat ? '▼' : '▶'} Expected Asset JSON Format
        </button>
        {showJsonFormat && (
          <div className="mt-3">
            <p className="text-sm text-gray-600 mb-2">
              This is the JSON structure the "Extract Cast" action should return,
              and what the Extracted Assets box expects. Characters and Locations
              have <code className="bg-gray-100 px-1 rounded">states</code> (different
              appearances/conditions). Props are single-state.
            </p>
            <pre className="bg-gray-900 text-green-300 p-4 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto">
              {ASSET_JSON_FORMAT}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppSettingsPanel;
