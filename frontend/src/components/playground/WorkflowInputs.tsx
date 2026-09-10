import React from 'react';

interface InputField {
  type: 'string' | 'int' | 'image';
  value: string | number;
}

interface WorkflowInputsProps {
  inputs: Record<string, InputField>;
  values: Record<string, any>;
  nodes: Record<string, any>;
  baseUrl: string;
  onChange: (role: string, value: any) => void;
}

const WorkflowInputs: React.FC<WorkflowInputsProps> = ({ inputs, values, nodes, onChange }) => {
  return (
    <div className="flex flex-col gap-4 mb-6">
      {Object.entries(inputs).map(([role, field]) => {
        const currentVal = values[role]?.value ?? "";

        if (field.type === 'string') {
          return (
            <div key={role} className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-gray-500">{role}</label>
              <textarea 
                className="p-2 border rounded bg-white"
                rows={3}
                value={currentVal}
                onChange={(e) => onChange(role, e.target.value)}
              />
            </div>
          );
        } else if (field.type === 'image') {
          // Find the specific node for this image role to get its ID
          const node = Object.values(nodes).find(n => 
            n._meta?.title?.toLowerCase().includes(role.toLowerCase())
          );
          const nodeId = node ? (node.id || role) : role;

          return (
            <div key={role} className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-gray-500">{role} (Node: {nodeId})</label>
              <input 
                type="file" 
                accept="image/*"
                className="p-2 border rounded bg-white"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    console.log(`Picked file for ${role} (Node: ${nodeId}): ${file.name}`);
                    onChange(role, file);
                  }
                }}
              />
            </div>
          );
        } else {
          return (
            <div key={role} className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-gray-500">{role}</label>
              <input 
                type="number" 
                className="p-2 border rounded bg-white"
                value={currentVal}
                onChange={(e) => onChange(role, e.target.value === "" ? 0 : parseInt(e.target.value))}
              />
            </div>
          );
        }
      })}
    </div>
  );
};

export default WorkflowInputs;