import React from 'react';
import { ImagePicker } from '../ImagePicker';
import { AudioPicker } from '../AudioPicker';

interface InputField {
  type: 'string' | 'int' | 'float' | 'image' | 'audio';
  value: string | number;
}

interface WorkflowInputsProps {
  inputs: Record<string, InputField>;
  values: Record<string, any>;
  nodes: Record<string, any>;
  baseUrl?: string;
  onChange: (role: string, value: any) => void;
}

const WorkflowInputs: React.FC<WorkflowInputsProps> = ({ inputs, values, nodes, baseUrl, onChange }) => {
  const getVal = (role: string) => values[role]?.value ?? '';

  return (
    <div className="flex flex-col gap-6 mb-6">
      {/* 1. String Inputs */}
      <div className="flex flex-col gap-4">
        {Object.entries(inputs).map(([role, field]) => {
          if (field.type === 'string') {
            return (
              <div key={role} className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">{role}</label>
                <textarea 
                  className="w-full p-2 border border-border rounded bg-card text-foreground"
                  rows={9}
                  value={getVal(role)}
                  onChange={(e) => onChange(role, e.target.value)}
                />
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* 3. Image Roles */}
      {Object.entries(inputs).some(([_, field]) => field.type === 'image') && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground mb-1">Images</label>
          <div className="flex flex-wrap gap-4 items-end">
            {Object.entries(inputs).filter(([_, field]) => field.type === 'image').map(([role]) => {
              const node = Object.values(nodes).find(n =>
                n._meta?.title?.toLowerCase().includes(role.toLowerCase())
              );
              const nodeId = node ? (node.id || role) : role;

              return (
                <div key={role} className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground">{role} ({nodeId})</label>
                  <ImagePicker onImageSelected={(file) => onChange(role, file)} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Audio Roles */}
      {Object.entries(inputs).some(([_, field]) => field.type === 'audio') && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground mb-1">Audio</label>
          <div className="flex flex-wrap gap-4 items-end">
            {Object.entries(inputs).filter(([_, field]) => field.type === 'audio').map(([role]) => {
              const node = Object.values(nodes).find(n =>
                n._meta?.title?.toLowerCase().includes(role.toLowerCase())
              );
              const nodeId = node ? (node.id || role) : role;

              return (
                <div key={role} className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground">{role} ({nodeId})</label>
                  <AudioPicker onAudioSelected={(file) => onChange(role, file)} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowInputs;
