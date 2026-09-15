import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useProjectStore } from '../store/projectStore';

interface GalleryProps {
  className?: string;
}

interface AssetData {
  id: string;
  name: string;
  description: string;
  states?: { id: string; name: string }[];
}

const Gallery: React.FC<GalleryProps> = ({ className }) => {
  const { backend } = useSettingsStore();
  const { currentProject } = useProjectStore();
  const [images, setImages] = useState<string[]>([]);
  const [types, setTypes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [assets, setAssets] = useState<{ characters: AssetData[]; locations: AssetData[]; props: AssetData[] }>({ characters: [], locations: [], props: [] });
  const [mapType, setMapType] = useState('');
  const [mapAsset, setMapAsset] = useState('');
  const [mapState, setMapState] = useState('');
  const [mapField, setMapField] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const baseUrl = backend?.apiUrl || 'http://127.0.0.1:8000';

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/gallery/`);
      if (!response.ok) throw new Error(`Failed to fetch gallery (Status: ${response.status})`);
      const data = await response.json();
      setImages(data.images || []);
      setTypes(data.types || {});
    } catch (err) {
      console.error("Gallery Fetch Error:", err);
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    if (!currentProject) return;
    try {
      const res = await fetch(`${baseUrl}/projects/${currentProject.id}/assets`);
      const data = await res.json();
      if (data.status === 'success') setAssets(data.assets);
    } catch (e) {
      console.error('Failed to fetch assets:', e);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [baseUrl]);

  useEffect(() => {
    if (selectedImage) fetchAssets();
  }, [selectedImage]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch(`${baseUrl}/gallery/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, data: reader.result as string }),
        });
        const data = await res.json();
        if (data.status === 'error') throw new Error(data.details);
        fetchImages();
      } catch (err) {
        console.error('Upload failed:', err);
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async () => {
    if (!selectedImage) return;
    setDeleting(true);
    try {
      const filename = selectedImage.split('/').pop() || '';
      const res = await fetch(`${baseUrl}/gallery/${filename}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'error') throw new Error(data.details);
      setSelectedImage(null);
      fetchImages();
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDeleting(false);
    }
  };

  const handleAssign = async () => {
    if (!mapAsset || !mapState || !mapField || !selectedImage) return;
    setAssigning(true);
    try {
      const res = await fetch(`${baseUrl}/gallery/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: mapAsset, stateId: mapState, imagePath: selectedImage, field: mapField }),
      });
      const data = await res.json();
      if (data.status === 'error') throw new Error(data.details);
      setSelectedImage(null);
      setMapType(''); setMapAsset(''); setMapState(''); setMapField('');
    } catch (e) {
      console.error('Assign failed:', e);
    } finally {
      setAssigning(false);
    }
  };

  const assetList: AssetData[] = mapType === 'characters' ? assets.characters : mapType === 'locations' ? assets.locations : assets.props;
  const selectedAsset = assetList.find(a => a.id === mapAsset);
  const canAssign = mapAsset && mapState && mapField;

  return (
    <div className={`flex flex-col w-full h-full border rounded-xl bg-white shadow-sm p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Gallery</h2>
        <div className="flex gap-2">
          <label className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors shadow-sm cursor-pointer">
            {uploading ? 'Adding...' : 'Add'}
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
          <button onClick={fetchImages} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors shadow-sm">
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 italic animate-pulse">Loading assets...</div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-400 italic">{error}</div>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-3 gap-1 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0 items-start">
            {images.map((img, index) => (
              <div key={index} className="relative group overflow-hidden bg-slate-50 w-full aspect-square cursor-pointer" onClick={() => setSelectedImage(img)}>
                {types[img] === 'video' ? (
                  <video src={`${baseUrl}${img}`} muted preload="metadata" className="w-full h-full object-cover" />
                ) : (
                  <img src={`${baseUrl}${img}`} alt={img} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300" />
                )}
                {types[img] === 'video' && (
                  <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/80 text-white text-[9px] px-1.5 py-0.5 rounded">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    VIDEO
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity">{img}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 italic">No images found in assets/generated/</div>
        )}
        <div className="mt-2 pt-2 border-t text-[10px] text-slate-400 flex justify-between">
          <span>Base URL: {baseUrl}</span>
          <span>Items Found: {images.length}</span>
        </div>
      </div>

      {/* Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setSelectedImage(null)}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-slate-800">{types[selectedImage] === 'video' ? 'Video Details' : 'Image Details'}</h3>
              <button onClick={() => { setSelectedImage(null); setMapType(''); setMapAsset(''); setMapState(''); setMapField(''); }} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            {types[selectedImage] === 'video' ? (
              <video src={`${baseUrl}${selectedImage}`} controls className="w-full max-h-[400px] rounded-lg mb-4 bg-black" />
            ) : (
              <img src={`${baseUrl}${selectedImage}`} alt={selectedImage} className="w-full max-h-[400px] object-contain rounded-lg mb-4 bg-slate-100" />
            )}
            <p className="text-xs text-slate-500 mb-4">{selectedImage}</p>

            <div className="flex gap-3 mb-4">
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              {types[selectedImage] !== 'video' && (
                <button onClick={() => setMapType(mapType ? '' : 'characters')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
                  {mapType ? 'Cancel Map' : 'Map to Asset'}
                </button>
              )}
            </div>

            {mapType && (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Type</label>
                  <select value={mapType} onChange={e => { setMapType(e.target.value); setMapAsset(''); setMapState(''); setMapField(''); }} className="w-full p-2 border rounded mt-1 text-sm">
                    <option value="">Select type</option>
                    <option value="characters">Character</option>
                    <option value="locations">Location</option>
                    <option value="props">Prop</option>
                  </select>
                </div>
                {mapType && (
                  <div>
                    <label className="text-sm font-medium text-slate-700">Asset</label>
                    <select value={mapAsset} onChange={e => { setMapAsset(e.target.value); setMapState(''); setMapField(''); }} className="w-full p-2 border rounded mt-1 text-sm">
                      <option value="">Select asset</option>
                      {assetList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                {mapAsset && selectedAsset?.states?.length ? (
                  <div>
                    <label className="text-sm font-medium text-slate-700">State</label>
                    <select value={mapState} onChange={e => { setMapState(e.target.value); setMapField(''); }} className="w-full p-2 border rounded mt-1 text-sm">
                      <option value="">Select state</option>
                      {selectedAsset.states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                ) : mapAsset && (
                  <div>
                    <label className="text-sm font-medium text-slate-700">Type</label>
                    <select value={mapField} onChange={e => setMapField(e.target.value)} className="w-full p-2 border rounded mt-1 text-sm">
                      <option value="">Select type</option>
                      <option value="imagePath">Asset Image</option>
                      <option value="characterSheet">Character Sheet</option>
                    </select>
                  </div>
                )}
                {mapState && (
                  <div>
                    <label className="text-sm font-medium text-slate-700">Image Type</label>
                    <select value={mapField} onChange={e => setMapField(e.target.value)} className="w-full p-2 border rounded mt-1 text-sm">
                      <option value="">Select type</option>
                      <option value="imagePath">Asset Image</option>
                      <option value="characterSheet">Character Sheet</option>
                    </select>
                  </div>
                )}
                {canAssign && (
                  <button onClick={handleAssign} disabled={assigning} className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50">
                    {assigning ? 'Assigning...' : 'Assign'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
