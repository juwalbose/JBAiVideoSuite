import React from 'react';

interface InputField {
  type: 'string' | 'int' | 'image';
  value: string | number;
}

interface WorkflowInputsProps {
  inputs: Record<string, InputField>;
  values: Record<string, any>;
  onChange: (role: string, value: any) => void;
}

const WorkflowInputs: React.FC<WorkflowInputsProps> = ({ inputs, values, onChange }) => {
  return (
    <div className="flex flex-col gap-4 mb-6">
      {Object.entries(inputs).map(([role, field]) => {
        if (field.type === 'string') {
          return (
            <div key={role} className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-gray-500">{role}</label>
              <textarea 
                className="p-2 border rounded bg-white"
                rows={3}
                value={values[role] ?? ""}
                onChange={(e) => onChange(role, e.target.value)}
              />
            </div>
          );
        } else if (field.type === 'image') {
          return (
            <div key={role} className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-gray-500">{role}</label>
              <input 
                type="file" 
                accept="image/*"
                className="p-2 border rounded bg-white"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    console.log(`Picked file for ${role}: ${file.name}`);
                    onChange(role, file.name);
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
                value={values[role] ?? ""}
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
