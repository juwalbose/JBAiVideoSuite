import React from 'react';

interface WorkflowItem {
  id: string;
  name: string;
}

interface WorkflowSelectorProps {
  workflows: WorkflowItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const WorkflowSelector = ({ workflows, selectedId, onSelect }: WorkflowSelectorProps) => {
  return (
    <section>
      <h3 className="text-lg font-bold mb-4">Workflow Selection</h3>
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
