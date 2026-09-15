import React, { useState, useRef, useEffect, ChangeEvent } from 'react';

interface ImagePickerProps {
  onImageSelected?: (file: File) => void;
  maxSizeMB?: number;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({ 
  onImageSelected, 
  maxSizeMB = 5 
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs when the component unmounts or image changes
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

    // Validate type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP, etc.).');
      return;
    }

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Image size exceeds ${maxSizeMB}MB.`);
      return;
    }

    // Cleanup previous preview URL before creating a new one
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);

    // Bubble the selected File object up to parent component
    if (onImageSelected) {
      onImageSelected(file);
    }
  };

  const handleRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    
    // Reset file input so picking the same file again triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-[360px] font-sans">
      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload trigger button */}
      {!previewUrl && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 rounded-md border border-border bg-card cursor-pointer text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
        >
          Choose Image
        </button>
      )}

      {/* Error display */}
      {error && (
        <p className="text-destructive text-xs mt-2">
          {error}
        </p>
      )}

      {/* Image Preview & Actions */}
      {previewUrl && (
        <div className="mt-3">
          <div className="relative rounded-lg overflow-hidden border border-border bg-muted shadow-sm hover:shadow-md transition-shadow duration-200">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-auto block"
            />
          </div>

          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-muted-foreground">
              {selectedFile?.name} ({((selectedFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB)
            </span>
            <button
              type="button"
              onClick={handleRemove}
              className="text-destructive text-xs font-medium hover:underline transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
