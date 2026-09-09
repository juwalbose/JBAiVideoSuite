import React from 'react';

interface GenerationResultProps {
  isGenerating: boolean;
  resultImage: string | null;
  onGenerate: () => void;
  isValid: boolean;
}

const GenerationResult: React.FC<GenerationResultProps> = ({ isGenerating, resultImage, onGenerate, isValid }) => {
  return (
    <>
      <button 
        onClick={onGenerate}
        disabled={isGenerating || !isValid}
        className={`px-8 py-3 rounded-full font-bold text-white transition-all ${isGenerating ? 'bg-gray-400' : 'bg-blue-600 hover:scale-105 shadow-lg'}`}
      >
        {isGenerating ? 'Generating...' : 'Generate'}
      </button>

      <div className="mt-8 flex justify-center">
        {resultImage ? (
          <img src={resultImage} alt="Generated result" className="max-w-full h-auto rounded shadow-md border" />
        ) : (
          <div className="w-64 h-64 bg-gray-200 flex items-center justify-center rounded text-gray-400 italic">
            Result will appear here
          </div>
        )}
      </div>
    </>
  );
};

export default GenerationResult;
