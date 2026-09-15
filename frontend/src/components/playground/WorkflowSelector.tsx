import React from 'react';

interface WorkflowItem {
  id: string;
  name: string;
}

interface WorkflowSelectorProps {
  workflows: WorkflowItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  queueCount: number;
}

const WorkflowSelector = ({ workflows, selectedId, onSelect, queueCount }: WorkflowSelectorProps) => {
  return (
    <div className="flex items-center gap-3">
      <select
        value={selectedId || ''}
        onChange={(e) => onSelect(e.target.value)}
        className="px-3 py-2 border rounded text-sm bg-white text-black"
      >
        {workflows.map(w => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
      {queueCount > 0 ? (
        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
          {queueCount} task{queueCount !== 1 ? 's' : ''} queued
        </span>
      ) : (
        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
          Gen complete
        </span>
      )}
    </div>
  );
};

export default WorkflowSelector;
