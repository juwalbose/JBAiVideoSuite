import React, { useState } from 'react';
import { ImagePicker } from '../ImagePicker';

interface InputField {
  type: 'string' | 'int' | 'image';
  value: string | number;
}

interface WorkflowInputsProps {
  inputs: Record<string, InputField>;
  values: Record<string, any>;
  nodes: Record<string, any>;
  baseUrl?: string;
  onChange: (role: string, value: any) => void;
}

const RESOLUTIONS = [
  { name: 'Square (512x512)', w: 512, h: 512 },
  { name: 'Square (768x768)', w: 768, h: 768 },
  { name: 'Square (1024x1024)', w: 1024, h: 1024 },
  { name: 'Landscape (1024x768)', w: 1024, h: 768 },
  { name: 'Landscape (1366x768)', w: 1366, h: 768 },
  { name: 'Landscape (1920x1080)', w: 1920, h: 1080 },
  { name: 'Landscape (2560x1440)', w: 2560, h: 1440 },
  { name: 'Landscape (3840x2160)', w: 3840, h: 2160 },
  { name: 'Portrait (768x1024)', w: 768, h: 1024 },
  { name: 'Portrait (1080x1366)', w: 1080, h: 1366 },
  { name: 'Portrait (1080x1920)', w: 1080, h: 1920 },
  { name: 'Portrait (1440x2560)', w: 1440, h: 2560 },
  { name: 'Portrait (2160x3840)', w: 2160, h: 3840 },
  { name: 'Custom', w: 0, h: 0 },
];

const WorkflowInputs: React.FC<WorkflowInputsProps> = ({ inputs, values, nodes, baseUrl, onChange }) => {
  const [selectedRes, setSelectedRes] = useState(RESOLUTIONS[5]);

  const handleResolutionChange = (index: number) => {
    setSelectedRes(RESOLUTIONS[index]);
    onChange('width', RESOLUTIONS[index].w);
    onChange('height', RESOLUTIONS[index].h);
  };

  const getVal = (role: string) => values[role]?.value ?? '';

  return (
    <div className="flex flex-col gap-6 mb-6">
      {/* 1. String Inputs */}
      <div className="flex flex-col gap-4">
        {Object.entries(inputs).map(([role, field]) => {
          if (field.type === 'string') {
            return (
              <div key={role} className="flex items-center gap-4">
                <label className="w-32 shrink-0 text-xs font-semibold uppercase text-gray-500">{role}</label>
                <textarea 
                  className="flex-1 p-2 border rounded bg-white"
                  rows={3}
                  value={getVal(role)}
                  onChange={(e) => onChange(role, e.target.value)}
                />
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* 2. Seed Input */}
      <div className="flex items-center gap-4">
        <label className="w-32 shrink-0 text-xs font-semibold uppercase text-gray-500">Seed</label>
        <div className="flex flex-1 items-center gap-2">
          <input 
            type="number" 
            className="p-2 border rounded bg-white w-full"
            value={getVal('seed')}
            onChange={(e) => onChange('seed', e.target.value === '' ? 0 : parseInt(e.target.value))}
          />
          <button
            type="button"
            onClick={() => onChange('seed', Math.floor(Math.random() * 1000000))}
            className="px-3 py-2 text-xs bg-gray-100 border rounded hover:bg-gray-200 transition-colors shadow-sm"
          >
            Randomize
          </button>
        </div>
      </div>

      {/* 3. Resolution & Dimensions */}
      <div className="flex flex-col gap-2 p-4 border rounded bg-gray-50">
        <label className="text-xs font-bold uppercase text-gray-600 mb-1">Resolution</label>
        <div className="flex items-center gap-4">
          <select 
            className="p-2 border rounded bg-white text-sm"
            value={selectedRes.name}
            onChange={(e) => handleResolutionChange(RESOLUTIONS.findIndex(r => r.name === e.target.value))}
          >
            {RESOLUTIONS.map((res, i) => (
              <option key={i} value={res.name}>{res.name}</option>
            ))}
          </select>

          {selectedRes.name !== 'Custom' && (
            <div className="flex flex-1 items-center gap-4">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Width</label>
                <input 
                  type="number" 
                  className="p-2 border rounded bg-white w-full"
                  value={getVal('width')}
                  onChange={(e) => onChange('width', e.target.value === '' ? 0 : parseInt(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Height</label>
                <input 
                  type="number" 
                  className="p-2 border rounded bg-white w-full"
                  value={getVal('height')}
                  onChange={(e) => onChange('height', e.target.value === '' ? 0 : parseInt(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Image Roles */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase text-gray-500 mb-1">Images</label>
        <div className="flex flex-wrap gap-4 items-end">
          {Object.entries(inputs).filter(([_, field]) => field.type === 'image').map(([role]) => {
            const node = Object.values(nodes).find(n => 
              n._meta?.title?.toLowerCase().includes(role.toLowerCase())
            );
            const nodeId = node ? (node.id || role) : role;

            return (
              <div key={role} className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400">{role} ({nodeId})</label>
                <ImagePicker onImageSelected={(file) => onChange(role, file)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkflowInputs;