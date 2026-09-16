import React, { useState } from 'react';

interface StateItem {
  name: string;
  description: string;
  scenes?: number[];
}

interface ExtractItem {
  type: string; // CHARACTER, LOCATION, PROP
  name: string;
  description: string;
  states: StateItem[];
  existingAssetId?: string;
  existingStates?: { id: string; name: string; description: string }[];
}

interface Selection {
  type: string;
  name: string;
  description: string;
  states: StateItem[];
  mode: 'new' | 'add_state';
  existingAssetId?: string;
}

interface Props {
  comparison: { new: ExtractItem[]; existing: ExtractItem[] };
  existingAssets: { id: string; name: string; type: string }[];
  onConfirm: (selections: Selection[]) => void;
  onCancel: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  CHARACTER: 'Character',
  LOCATION: 'Location',
  PROP: 'Prop',
};

const TYPE_COLORS: Record<string, string> = {
  CHARACTER: 'bg-blue-900/30 border-blue-700',
  LOCATION: 'bg-emerald-900/30 border-emerald-700',
  PROP: 'bg-amber-900/30 border-amber-700',
};

// A state row: either extracted (new) or existing (from DB)
interface StateRow {
  key: string;
  name: string;
  description: string;
  scenes?: number[];
  source: 'extracted' | 'existing';
  existingStateId?: string;
}

const ExtractComparisonModal = ({ comparison, existingAssets, onConfirm, onCancel }: Props) => {
  // Per-state-row selection: key -> selected (bool)
  const [stateSelections, setStateSelections] = useState<Record<string, boolean>>({});
  // Per-asset mode: key -> 'new' | 'add_state'
  const [assetModes, setAssetModes] = useState<Record<string, 'new' | 'add_state'>>({});
  // Per-asset existing target (for add_state mode)
  const [assetTargets, setAssetTargets] = useState<Record<string, string>>({});

  const allItems = [
    ...comparison.new.map((item) => ({ ...item, isNew: true })),
    ...comparison.existing.map((item) => ({ ...item, isNew: false })),
  ];

  const getAssetKey = (item: ExtractItem & { isNew: boolean }) => `${item.type}:${item.name}`;

  // Build state rows for an item: extracted states + existing DB states (for existing items)
  const getStateRows = (item: ExtractItem & { isNew: boolean }): StateRow[] => {
    const rows: StateRow[] = [];
    // Extracted states
    for (const s of item.states || []) {
      rows.push({
        key: `${getAssetKey(item)}:${s.name}`,
        name: s.name,
        description: s.description,
        scenes: s.scenes,
        source: 'extracted',
      });
    }
    // Existing DB states (only for existing items)
    if (!item.isNew && item.existingStates) {
      for (const s of item.existingStates) {
        // Skip if already covered by an extracted state with the same name
        const alreadyCovered = rows.some((r) => r.name.toLowerCase() === s.name.toLowerCase());
        if (!alreadyCovered) {
          rows.push({
            key: `${getAssetKey(item)}:existing:${s.id}`,
            name: s.name,
            description: s.description,
            source: 'existing',
            existingStateId: s.id,
          });
        }
      }
    }
    return rows;
  };

  const isStateSelected = (row: StateRow) => stateSelections[row.key] !== false; // default: selected

  const toggleState = (row: StateRow) => {
    setStateSelections((prev) => ({
      ...prev,
      [row.key]: !isStateSelected(row),
    }));
  };

  const getAssetMode = (item: ExtractItem & { isNew: boolean }) => {
    const key = getAssetKey(item);
    if (item.isNew) return 'new' as const;
    return assetModes[key] || 'add_state';
  };

  const setAssetMode = (item: ExtractItem & { isNew: boolean }, mode: 'new' | 'add_state') => {
    const key = getAssetKey(item);
    setAssetModes((prev) => ({ ...prev, [key]: mode }));
  };

  const getAssetTarget = (item: ExtractItem & { isNew: boolean }) => {
    const key = getAssetKey(item);
    return assetTargets[key] || (item.existingAssetId || '');
  };

  const setAssetTarget = (item: ExtractItem & { isNew: boolean }, id: string) => {
    const key = getAssetKey(item);
    setAssetTargets((prev) => ({ ...prev, [key]: id }));
  };

  const handleConfirm = () => {
    const selections: Selection[] = [];
    for (const item of allItems) {
      const rows = getStateRows(item);
      const selectedStates = rows.filter((r) => isStateSelected(r));
      if (selectedStates.length === 0) continue;

      const mode = getAssetMode(item);
      const targetId = getAssetTarget(item);

      // Build the states array from selected rows
      const states: StateItem[] = selectedStates.map((r) => ({
        name: r.name,
        description: r.description,
        scenes: r.scenes,
      }));

      selections.push({
        type: item.type,
        name: item.name,
        description: item.description,
        states,
        mode,
        existingAssetId: mode === 'add_state' ? targetId : undefined,
      });
    }
    onConfirm(selections);
  };

  // Count total selected states
  let totalStates = 0;
  let selectedStates = 0;
  for (const item of allItems) {
    const rows = getStateRows(item);
    for (const r of rows) {
      totalStates++;
      if (isStateSelected(r)) selectedStates++;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-card border border-border rounded-lg w-[90vw] max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Review Extracted States</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {allItems.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No assets extracted.</p>
          )}

          {(['CHARACTER', 'LOCATION', 'PROP'] as const).map((type) => {
            const items = allItems.filter((i) => i.type === type);
            if (items.length === 0) return null;
            return (
              <section key={type}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {TYPE_LABELS[type]}s ({items.length})
                </h3>
                <div className="space-y-3">
                  {items.map((item) => {
                    const rows = getStateRows(item);
                    const mode = getAssetMode(item);
                    const targetId = getAssetTarget(item);
                    const existingOptions = existingAssets.filter((a) => a.type === item.type);
                    const selectedCount = rows.filter((r) => isStateSelected(r)).length;

                    return (
                      <div
                        key={getAssetKey(item)}
                        className={`border rounded-lg p-3 ${TYPE_COLORS[item.type]}`}
                      >
                        {/* Asset header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-foreground">{item.name}</span>
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                          {!item.isNew && (
                            <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                              Already exists
                            </span>
                          )}
                        </div>

                        {/* States list — each state is a selectable row */}
                        <div className="ml-4 space-y-1 mb-2">
                          {rows.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">No states</p>
                          )}
                          {rows.map((row) => (
                            <label
                              key={row.key}
                              className={`flex items-center gap-2 text-xs cursor-pointer rounded px-2 py-1 ${
                                isStateSelected(row) ? 'bg-card/50' : 'opacity-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isStateSelected(row)}
                                onChange={() => toggleState(row)}
                                className="accent-accent"
                              />
                              <span className="text-foreground font-medium">{row.name}</span>
                              <span className="text-muted-foreground truncate">{row.description}</span>
                              {row.source === 'existing' && (
                                <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                                  existing
                                </span>
                              )}
                            </label>
                          ))}
                        </div>

                        {/* Mode selector (only for existing assets) */}
                        {!item.isNew && (
                          <div className="ml-4 flex items-center gap-3">
                            <label className="text-xs text-muted-foreground">Add as:</label>
                            <select
                              value={mode}
                              onChange={(e) => setAssetMode(item, e.target.value as 'new' | 'add_state')}
                              className="bg-card border border-border rounded px-2 py-1 text-xs text-foreground"
                            >
                              <option value="add_state">Add States to Existing</option>
                              <option value="new">Create New Asset</option>
                            </select>

                            {mode === 'add_state' && (
                              <select
                                value={targetId}
                                onChange={(e) => setAssetTarget(item, e.target.value)}
                                className="bg-card border border-border rounded px-2 py-1 text-xs text-foreground"
                              >
                                <option value="">Select existing asset...</option>
                                {existingOptions.map((a) => (
                                  <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}

                        {/* Selection count */}
                        <div className="ml-4 mt-1 text-[10px] text-muted-foreground">
                          {selectedCount} of {rows.length} states selected
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedStates} of {totalStates} states selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedStates === 0}
              className="px-4 py-2 bg-accent text-accent-foreground rounded hover:bg-accent/80 disabled:opacity-50 transition-colors"
            >
              Save Selected ({selectedStates} states)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtractComparisonModal;
