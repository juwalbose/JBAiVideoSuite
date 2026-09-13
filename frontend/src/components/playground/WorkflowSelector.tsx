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
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-lg font-bold">Workflow Selection</h3>
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
      <div className="flex flex-wrap gap-2">
        {workflows.map(w => (
          <button
            key={w.id}
            onClick={() => onSelect(w.id)}
            className={`px-4 py-2 rounded border ${selectedId === w.id ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'}`}
          >
            {w.name}
          </button>
        ))}
      </div>
    </section>
  );
};

export default WorkflowSelector;
