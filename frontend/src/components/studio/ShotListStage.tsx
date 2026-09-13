import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';

const ShotListStage = ({ selectedEpisode }: { selectedEpisode: number }) => {
  const { currentProject } = useProjectStore();
  const [shots, setShots] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateShots = async () => {
    if (!currentProject) return;
    setIsLoading(true);
    setError('');
    try {
      const baseUrl = useSettingsStore.getState().backend.apiUrl;
      const response = await fetch(`${baseUrl}/projects/${currentProject.id}/generate-shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.status === 'error') {
        setError(data.details);
        return;
      }
      setShots(data.shots || '');
    } catch (err) {
      console.error('Error generating shots:', err);
      setError('Failed to generate shots. Check backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {currentProject?.type === 'episodic' && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Episode:</label>
          <span className="text-sm text-gray-500">Episode {selectedEpisode}</span>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-2 text-blue-900">Shot List</h3>
        <textarea
          className="w-full p-4 border rounded bg-white text-black resize-y"
          rows={20}
          placeholder="Shots will appear here after generating from the Script..."
          value={shots}
          onChange={(e) => setShots(e.target.value)}
        />
      </div>

      {error && (
        <div className="p-4 border border-red-300 bg-red-50 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-center gap-4 mt-4 pt-4 border-t">
        <button
          onClick={handleGenerateShots}
          disabled={isLoading || !currentProject?.script?.content}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Generating...' : shots ? 'Regenerate Shots' : 'Generate Shots'}
        </button>
      </div>
    </div>
  );
};

export default ShotListStage;
