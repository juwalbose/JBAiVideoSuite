import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';

interface GalleryProps {
  className?: string;
}

const Gallery: React.FC<GalleryProps> = ({ className }) => {
  const { backendSettings } = useSettingsStore();
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the apiUrl from settings (e.g., "http://127.0.0.1:8000")
  // We'll fallback to localhost:8000 if it's not loaded yet
  const baseUrl = backendSettings?.apiUrl || 'http://localhost:8000';

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    try {
      // Added a trailing slash to ensure consistency
      const response = await fetch(`${baseUrl}/gallery/`);
      if (!response.ok) throw new Error(`Failed to fetch gallery (Status: ${response.status})`);
      const data = await response.json();
      setImages(data.images || []);
    } catch (err) {
      console.error("Gallery Fetch Error:", err);
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [baseUrl]); // Re-run if baseUrl changes

  return (
    <div className={`flex flex-col h-full w-full border rounded-xl bg-white shadow-sm p-4 ${className}`}>
      <div className="flex justify-between items-center mb-6 border-b pb-2">
        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Gallery</h2>
        <button 
          onClick={fetchImages}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors shadow-sm"
        >
          Refresh
        </button>
      </div>
      
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 italic animate-pulse">
            Loading assets...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-400 italic">
            {error}
          </div>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 overflow-y-auto pr-2 custom-scrollbar">
            {images.map((img, index) => (
              <div key={index} className="relative group rounded-lg overflow-hidden border bg-slate-50 shadow-sm hover:shadow-md transition-shadow duration-200">
                <img 
                  src={`${baseUrl}${img}`} 
                  alt={`${img}`}
                  className="w-full h-32 object-cover transform group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  {img}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 italic">
            No images found in assets/generated/
          </div>
        )}

        {/* Debug Info - This will help us see exactly what's happening */}
        <div className="mt-4 pt-2 border-t text-[10px] text-slate-400 flex justify-between">
          <span>Base URL: {baseUrl}</span>
          <span>Images Found: {images.length}</span>
        </div>
      </div>
    </div>
  );
};

export default Gallery;
