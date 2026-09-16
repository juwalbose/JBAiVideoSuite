import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const APP_ACTIONS = [
  'Develop Raw Story',
  'Extract Cast',
  'Generate Script',
  'Generate Prompt',
  'Generate Video Prompt',
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
      "states": [
        {
          "name": "State Name (e.g. 'Closed', 'Open')",
          "description": "Description of this state",
          "scenes": ["Scene 2"]
        }
      ]
    }
  ]
}`;

const SHOT_JSON_FORMAT = `{
  "shots": [
    {
      "shot": 1,
      "scene": 1,
      "beats": [1],
      "loc": "Dense emerald forest, morning light filtering through heavy canopy",
      "subs": ["Sage Kanva", "Shakuntala"],
      "frames": 158,
      "duration": 6.5,
      "camera": "Wide shot, camera positioned low to ground level looking up at the trees",
      "action": "The birds scatter violently from a bed of ferns toward the upper canopy",
      "dialogue": "",
      "note": "Action-heavy opening; wide framing allows for large bird movement without clipping."
    }
  ]
}`;

const COMFY_ACTIONS = [
  'Asset Generation',
  'Character Sheet Generation',
  'MinimaxH3 Ref2VA Generation',
];

type ResSettings = { character: { w: number; h: number }; location: { w: number; h: number }; prop: { w: number; h: number } };

const AppSettingsPanel = () => {
  const { backend } = useSettingsStore();
  const [mappings, setMappings] = useState<Record<string, string | null>>({});
  const [prompts, setPrompts] = useState<{ id: string; name: string }[]>([]);
  const [comfyMappings, setComfyMappings] = useState<Record<string, string | null>>({});
  const [workflowFiles, setWorkflowFiles] = useState<string[]>([]);
  const [resSettings, setResSettings] = useState<ResSettings>({
    character: { w: 1024, h: 1024 },
    location: { w: 1920, h: 1080 },
    prop: { w: 1024, h: 1024 },
  });
  const [videoRes, setVideoRes] = useState<{ low: { w: number; h: number }; high: { w: number; h: number } }>({
    low: { w: 960, h: 544 },
    high: { w: 1920, h: 1080 },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showJsonFormat, setShowJsonFormat] = useState(false);
  const [showShotFormat, setShowShotFormat] = useState(false);

  useEffect(() => {
    const baseUrl = backend.apiUrl;
    Promise.all([
      fetch(`${baseUrl}/appsettings/`).then(r => r.json()),
      fetch(`${baseUrl}/systemprompts/`).then(r => r.json()),
      fetch(`${baseUrl}/appsettings/workflows`).then(r => r.json()),
      fetch(`${baseUrl}/appsettings/workflows/files`).then(r => r.json()),
      fetch(`${baseUrl}/appsettings/resolutions`).then(r => r.json()),
      fetch(`${baseUrl}/appsettings/video-resolutions`).then(r => r.json()),
    ])
      .then(([m, p, cm, wf, res, vres]) => {
        setPrompts(p);
        const validIds = new Set(p.map((x: { id: string }) => x.id));
        const cleaned: Record<string, string | null> = {};
        for (const [action, file] of Object.entries(m as Record<string, string>)) {
          cleaned[action] = file && validIds.has(file) ? file : null;
        }
        setMappings(cleaned);
        // M45: validate workflow mappings against available files
        const validWfFiles = new Set(wf as string[]);
        const cleanedComfy: Record<string, string | null> = {};
        for (const [action, file] of Object.entries(cm as Record<string, string>)) {
          cleanedComfy[action] = file && validWfFiles.has(file) ? file : null;
        }
        setComfyMappings(cleanedComfy);
        setWorkflowFiles(wf as string[]);
        if (res && res.character) setResSettings(res as ResSettings);
        if (vres && vres.low) setVideoRes(vres);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [backend.apiUrl]);

  const handleSave = async () => {
    const baseUrl = backend.apiUrl;
    setSaving(true);
    setSaved(false);
    try {
      await Promise.allSettled([
        ...Object.entries(mappings).map(([action, promptFile]) =>
          fetch(`${baseUrl}/appsettings/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, promptFile }),
          })
        ),
        ...Object.entries(comfyMappings).map(([action, workflowFile]) =>
          fetch(`${baseUrl}/appsettings/workflows/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, workflowFile }),
          })
        ),
        fetch(`${baseUrl}/appsettings/resolutions/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resSettings),
        }),
        fetch(`${baseUrl}/appsettings/video-resolutions/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(videoRes),
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save mappings:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">App Settings</h2>
        <p className="text-muted-foreground">Map system prompts to app actions. Leave as "None" to use default behavior.</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">LLM System Prompt Mapping</h3>
        <div className="space-y-4">
          {APP_ACTIONS.map((action) => (
            <div key={action} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
              <span className="font-medium text-foreground">{action}</span>
              <select
                value={mappings[action] || ''}
                onChange={(e) => setMappings(prev => ({ ...prev, [action]: e.target.value || null }))}
                className="p-2 border border-border rounded bg-card text-foreground text-sm max-w-xs"
              >
                <option value="">None</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">ComfyUI Generation Mapping</h3>
        <p className="text-sm text-muted-foreground mb-3">Map generation actions to ComfyUI workflow JSON files in <code className="bg-muted px-1 rounded">assets/workflows/</code>.</p>
        <div className="space-y-4">
          {COMFY_ACTIONS.map((action) => (
            <div key={action} className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{action}</span>
                <select
                  value={comfyMappings[action] || ''}
                  onChange={(e) => setComfyMappings(prev => ({ ...prev, [action]: e.target.value || null }))}
                  className="p-2 border border-border rounded bg-card text-foreground text-sm max-w-xs"
                >
                  <option value="">None</option>
                  {workflowFiles.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              {action === 'Asset Generation' && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Resolution Settings</p>
                  {(['character', 'location', 'prop'] as const).map((type) => (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-24 capitalize">{type}</span>
                      <input
                        type="number"
                        className="w-20 p-1 border border-border rounded bg-card text-foreground text-sm"
                        value={resSettings[type].w}
                        onChange={(e) => setResSettings(prev => ({ ...prev, [type]: { ...prev[type], w: Number(e.target.value) } }))}
                        placeholder="Width"
                      />
                      <span className="text-muted-foreground">×</span>
                      <input
                        type="number"
                        className="w-20 p-1 border border-border rounded bg-card text-foreground text-sm"
                        value={resSettings[type].h}
                        onChange={(e) => setResSettings(prev => ({ ...prev, [type]: { ...prev[type], h: Number(e.target.value) } }))}
                        placeholder="Height"
                      />
                    </div>
                  ))}
                </div>
              )}
              {action === 'MinimaxH3 Ref2VA Generation' && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Resolution Settings</p>
                  {(['low', 'high'] as const).map((type) => (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-24 capitalize">{type} Res</span>
                      <input
                        type="number"
                        className="w-20 p-1 border border-border rounded bg-card text-foreground text-sm"
                        value={videoRes[type].w}
                        onChange={(e) => setVideoRes(prev => ({ ...prev, [type]: { ...prev[type], w: Number(e.target.value) } }))}
                        placeholder="Width"
                      />
                      <span className="text-muted-foreground">×</span>
                      <input
                        type="number"
                        className="w-20 p-1 border border-border rounded bg-card text-foreground text-sm"
                        value={videoRes[type].h}
                        onChange={(e) => setVideoRes(prev => ({ ...prev, [type]: { ...prev[type], h: Number(e.target.value) } }))}
                        placeholder="Height"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-accent text-accent-foreground rounded hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Mappings'}
        </button>
        {saved && <span className="text-success text-sm">Saved!</span>}
      </div>

      <div className="border-t border-border pt-4 space-y-4">
        <div>
          <button
            onClick={() => setShowJsonFormat(!showJsonFormat)}
            className="text-sm text-accent hover:underline flex items-center gap-1"
          >
            {showJsonFormat ? '▼' : '▶'} Expected Asset JSON Format
          </button>
          {showJsonFormat && (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground mb-2">
                This is the JSON structure the "Extract Cast" action should return,
                and what the Extracted Assets box expects. All asset types
                (Characters, Locations, Props) have <code className="bg-muted px-1 rounded">states</code>
                (different appearances/conditions — e.g. a suitcase can be "Closed" or "Open").
              </p>
              <pre className="bg-card text-foreground border border-border p-4 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto">
                {ASSET_JSON_FORMAT}
              </pre>
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setShowShotFormat(!showShotFormat)}
            className="text-sm text-accent hover:underline flex items-center gap-1"
          >
            {showShotFormat ? '▼' : '▶'} Expected Shot JSON Format
          </button>
          {showShotFormat && (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground mb-2">
                This is the JSON structure the "Generate Shots" action should return.
                Each shot has a <code className="bg-muted px-1 rounded">frames</code> value
                matching the 17n+5 grid, and a <code className="bg-muted px-1 rounded">duration</code> in seconds.
              </p>
              <pre className="bg-card text-foreground border border-border p-4 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto">
                {SHOT_JSON_FORMAT}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppSettingsPanel;
