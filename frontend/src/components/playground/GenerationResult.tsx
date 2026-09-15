import React from 'react';

interface GenerationResultProps {
  isGenerating: boolean;
  queueCount: number;
  resultImage: string | null;
  resultType?: 'image' | 'video';
  onGenerate: () => void;
  isValid: boolean;
}

const GenerationResult: React.FC<GenerationResultProps> = ({ isGenerating, resultImage, resultType = 'image' }) => {
  return (
    <div className="w-full aspect-[960/544] bg-black rounded shadow-md border overflow-hidden">
      {resultImage ? (
        resultType === 'video' ? (
          <video src={resultImage} controls className="w-full h-full object-contain" />
        ) : (
          <img src={resultImage} alt="Generated result" className="w-full h-full object-contain" />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 italic">
          Result will appear here
        </div>
      )}
    </div>
  );
};

export default GenerationResult;
