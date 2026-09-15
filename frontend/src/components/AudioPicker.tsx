import React, { useState, useRef, useEffect, ChangeEvent } from 'react';

interface AudioPickerProps {
  onAudioSelected?: (file: File) => void;
  maxSizeMB?: number;
}

export const AudioPicker: React.FC<AudioPickerProps> = ({
  onAudioSelected,
  maxSizeMB = 20
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);

    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setError('Please select a valid audio file (MP3, WAV, OGG, etc.).');
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Audio size exceeds ${maxSizeMB}MB.`);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);

    if (onAudioSelected) {
      onAudioSelected(file);
    }
  };

  const handleRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-[360px] font-sans">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {!previewUrl && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 rounded-md border border-gray-300 bg-white cursor-pointer text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
        >
          Choose Audio
        </button>
      )}

      {error && (
        <p className="text-red-600 text-xs mt-2">
          {error}
        </p>
      )}

      {previewUrl && (
        <div className="mt-3">
          <audio src={previewUrl} controls className="w-full" />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">
              {selectedFile?.name} ({((selectedFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB)
            </span>
            <button
              type="button"
              onClick={handleRemove}
              className="text-red-600 text-xs font-medium hover:underline transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
