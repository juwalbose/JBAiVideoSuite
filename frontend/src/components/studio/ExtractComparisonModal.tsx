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
  stateName?: string;
  stateDescription?: string;
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

const ExtractComparisonModal = ({ comparison, existingAssets, onConfirm, onCancel }: Props) => {
  // Per-item state: selected (bool), mode ('new' | 'add_state'), existingAssetId, stateName, stateDescription
  const [itemStates, setItemStates] = useState<Record<string, {
    selected: boolean;
    mode: 'new' | 'add_state';
    existingAssetId: string;
    stateName: string;
    stateDescription: string;
  }>>({});

  const allItems = [
    ...comparison.new.map((item) => ({ ...item, isNew: true })),
    ...comparison.existing.map((item) => ({ ...item, isNew: false })),
  ];

  const getItemKey = (item: ExtractItem & { isNew: boolean }) => `${item.type}:${item.name}`;

  const getItemState = (item: ExtractItem & { isNew: boolean }) => {
    const key = getItemKey(item);
    if (!itemStates[key]) {
      return { selected: true, mode: 'new' as const, existingAssetId: '', stateName: '', stateDescription: '' };
    }
    return itemStates[key];
  };

  const setItemState = (item: ExtractItem & { isNew: boolean }, patch: Partial<{
    selected: boolean;
    mode: 'new' | 'add_state';
    existingAssetId: string;
    stateName: string;
    stateDescription: string;
  }>) => {
    const key = getItemKey(item);
    setItemStates((prev) => ({
      ...prev,
      [key]: { ...getItemState(item), ...patch },
    }));
  };

  const handleConfirm = () => {
    const selections: Selection[] = [];
    for (const item of allItems) {
      const st = getItemState(item);
      if (!st.selected) continue;
      selections.push({
        type: item.type,
        name: item.name,
        description: item.description,
        states: item.states,
        mode: st.mode,
        existingAssetId: st.mode === 'add_state' ? st.existingAssetId : undefined,
        stateName: st.mode === 'add_state' ? st.stateName : undefined,
        stateDescription: st.mode === 'add_state' ? st.stateDescription : undefined,
      });
    }
    onConfirm(selections);
  };

  const selectedCount = allItems.filter((item) => getItemState(item).selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-card border border-border rounded-lg w-[90vw] max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Review Extracted Assets</h2>
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
                <div className="space-y-2">
                  {items.map((item) => {
                    const st = getItemState(item);
                    const existingOptions = existingAssets.filter((a) => a.type === item.type);
                    return (
                      <div
                        key={getItemKey(item)}
                        className={`border rounded-lg p-3 ${TYPE_COLORS[item.type]} ${!st.selected ? 'opacity-50' : ''}`}
                      >
                        {/* Top row: checkbox + name + badge */}
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={st.selected}
                            onChange={(e) => setItemState(item, { selected: e.target.checked })}
                            className="accent-accent"
                          />
                          <span className="font-medium text-foreground">{item.name}</span>
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                          {!item.isNew && (
                            <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                              Already exists
                            </span>
                          )}
                        </div>

                        {/* States list */}
                        {item.states.length > 0 && (
                          <div className="ml-6 mb-2 space-y-1">
                            {item.states.map((s, i) => (
                              <div key={i} className="text-xs text-muted-foreground">
                                <span className="text-foreground">{s.name}</span>: {s.description}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Mode selector */}
                        <div className="ml-6 flex items-center gap-3">
                          <label className="text-xs text-muted-foreground">Add as:</label>
                          <select
                            value={st.mode}
                            onChange={(e) => setItemState(item, { mode: e.target.value as 'new' | 'add_state' })}
                            className="bg-card border border-border rounded px-2 py-1 text-xs text-foreground"
                          >
                            <option value="new">New Asset</option>
                            <option value="add_state">Add State to Existing</option>
                          </select>

                          {st.mode === 'add_state' && (
                            <>
                              <select
                                value={st.existingAssetId}
                                onChange={(e) => setItemState(item, { existingAssetId: e.target.value })}
                                className="bg-card border border-border rounded px-2 py-1 text-xs text-foreground"
                              >
                                <option value="">Select existing asset...</option>
                                {existingOptions.map((a) => (
                                  <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>

                        {/* State details (when adding to existing) */}
                        {st.mode === 'add_state' && st.existingAssetId && (
                          <div className="ml-6 mt-2 space-y-2">
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">State Name</label>
                              <input
                                type="text"
                                value={st.stateName}
                                onChange={(e) => setItemState(item, { stateName: e.target.value })}
                                className="w-full bg-card border border-border rounded px-2 py-1 text-xs text-foreground"
                                placeholder="e.g. Injured, Night, Wounded"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">State Description</label>
                              <input
                                type="text"
                                value={st.stateDescription}
                                onChange={(e) => setItemState(item, { stateDescription: e.target.value })}
                                className="w-full bg-card border border-border rounded px-2 py-1 text-xs text-foreground"
                                placeholder="Description of this state"
                              />
                            </div>
                          </div>
                        )}
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
            {selectedCount} of {allItems.length} selected
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
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-accent text-accent-foreground rounded hover:bg-accent/80 disabled:opacity-50 transition-colors"
            >
              Save Selected ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtractComparisonModal;
