import React from 'react';
import type { DesignType, GeminiModel, Resolution } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../hooks/useTheme';

interface OutputConfigSectionProps {
  mockupCount: number;
  onMockupCountChange: (count: number) => void;
  generateText: boolean;
  onGenerateTextChange: (value: boolean) => void;
  withHuman: boolean;
  onWithHumanChange: (value: boolean) => void;
  designType: DesignType | null;
  selectedModel: GeminiModel | null;
  resolution: Resolution;
  onResolutionChange: (resolution: Resolution) => void;
}

export const OutputConfigSection: React.FC<OutputConfigSectionProps> = ({
  mockupCount,
  onMockupCountChange,
  generateText,
  onGenerateTextChange,
  withHuman,
  onWithHumanChange,
  designType,
  selectedModel,
  resolution,
  onResolutionChange
}) => {
  const isProModel = selectedModel === 'gemini-3-pro-image-preview';
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  return (
    <section>
      <h2 className={`text-sm font-semibold font-mono uppercase tracking-widest mb-3 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>{t('mockup.outputConfig')}</h2>
      <div className="space-y-3">
        {isProModel && (
          <div>
            <h4 className={`text-xs font-mono mb-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}>{t('mockup.resolution4kOnly')}</h4>
            <div className="flex gap-2 cursor-pointer">
              {(['1K', '2K', '4K'] as Resolution[]).map(res => (
                <button
                  key={res}
                  onClick={() => onResolutionChange(res)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-mono rounded-md transition-all duration-200 border cursor-pointer ${
                    resolution === res 
                      ? 'bg-[#52ddeb]/20 text-[#52ddeb] border-[#52ddeb]/30' 
                      : theme === 'dark'
                        ? 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600'
                        : 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:border-zinc-400'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <h4 className={`text-xs font-mono mb-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}>{t('mockup.numberOfImages')}</h4>
          <div className="flex gap-2 cursor-pointer">
            {[1, 2, 3, 4].map(count => (
              <button
                key={count}
                onClick={() => onMockupCountChange(count)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-mono rounded-md transition-all duration-200 border cursor-pointer ${
                  mockupCount === count 
                    ? 'bg-[#52ddeb]/20 text-[#52ddeb] border-[#52ddeb]/30' 
                    : theme === 'dark'
                      ? 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:border-zinc-400'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {designType !== 'blank' && (
            <div 
              className={`flex-1 flex items-center p-2.5 rounded-md cursor-pointer border ${theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-zinc-100 border-zinc-300'}`}
              onClick={() => onGenerateTextChange(!generateText)}
            >
              <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all duration-200 ${
                generateText ? 'bg-[#52ddeb]/80 border-[#52ddeb]' : theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : 'bg-white border-zinc-400'
              }`}>
                {generateText && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <label className={`ml-3 text-xs select-none cursor-pointer ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-700'}`}>{t('mockup.generateContextualText')}</label>
            </div>
          )}
          <div 
            className={`flex items-center p-2.5 rounded-md cursor-pointer border ${designType !== 'blank' ? 'flex-1' : 'w-full'} ${theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-zinc-100 border-zinc-300'}`}
            onClick={() => onWithHumanChange(!withHuman)}
          >
            <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all duration-200 ${
              withHuman ? 'bg-[#52ddeb]/80 border-[#52ddeb]' : theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : 'bg-white border-zinc-400'
            }`}>
              {withHuman && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <label className={`ml-3 text-xs select-none cursor-pointer ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-700'}`}>{t('mockup.includeHumanInteraction')}</label>
          </div>
        </div>
      </div>
    </section>
  );
};


