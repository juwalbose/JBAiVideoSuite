import React from 'react';

interface GenerationResultProps {
  isGenerating: boolean;
  queueCount: number;
  resultImage: string | null;
  resultType?: 'image' | 'video';
  onGenerate: () => void;
  isValid: boolean;
}

const GenerationResult: React.FC<GenerationResultProps> = ({ isGenerating, queueCount, resultImage, resultType = 'image', onGenerate, isValid }) => {
  return (
    <>
      <div className="flex justify-center">
        {resultImage ? (
          resultType === 'video' ? (
            <video src={resultImage} controls className="max-w-full h-auto rounded shadow-md border bg-black" />
          ) : (
            <img src={resultImage} alt="Generated result" className="max-w-full h-auto rounded shadow-md border" />
          )
        ) : (
          <div className="w-64 h-64 bg-gray-200 flex items-center justify-center rounded text-gray-400 italic">
            Result will appear here
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={onGenerate}
          disabled={!isValid}
          className={`px-8 py-3 rounded-full font-bold text-white transition-all ${isGenerating ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:scale-105 shadow-lg'}`}
        >
          {isGenerating ? 'Queue Another' : 'Generate'}
        </button>
      </div>
    </>
  );
};

export default GenerationResult;
