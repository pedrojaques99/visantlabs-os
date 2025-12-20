import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateMockup?: () => void;
}

interface TutorialStep {
  number: number;
  description: string;
  imagePosition: 'left' | 'right';
  isVideo?: boolean;
  videoId?: string;
}

const imgImage7 = 'http://localhost:3845/assets/272c169546a2549cd6cb2968161287d8b5d94e46.png';

export const Tutorial: React.FC<TutorialProps> = ({ isOpen, onClose, onCreateMockup }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const steps: TutorialStep[] = [
    {
      number: 1,
      description: t('tutorial.videoStep.description'),
      imagePosition: 'left' as const,
      isVideo: true,
      videoId: 'nzLeKvcL6-Y',
    },
    {
      number: 2,
      description: t('tutorial.newStep1.description'),
      imagePosition: 'left' as const,
    },
    {
      number: 3,
      description: t('tutorial.newStep2.description'),
      imagePosition: 'right' as const,
    },
    {
      number: 4,
      description: t('tutorial.newStep3.description'),
      imagePosition: 'left' as const,
    },
    {
      number: 5,
      description: t('tutorial.newStep4.description'),
      imagePosition: 'right' as const,
    },
  ];

  const cardBg = theme === 'dark' ? '#1a1a1a' : '#fafafa';
  const cardBorder = theme === 'dark' ? '#2a2a2a' : '#e5e5e5';
  const textColor = theme === 'dark' ? 'text-zinc-200' : 'text-zinc-700';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-md p-4 sm:p-6 py-6 sm:py-8 md:py-10 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-2xl lg:max-w-3xl ${textColor} mb-6 sm:mb-8 md:mb-10`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`fixed top-4 right-4 sm:top-6 sm:right-6 md:top-8 md:right-8 z-20 transition-all duration-300 cursor-pointer rounded-md p-2 hover:bg-white/5 backdrop-blur-sm ${
            theme === 'dark' ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700'
          }`}
          aria-label={t('tutorial.close')}
        >
          <X className="size-4 sm:size-5" />
        </button>

        {/* Tutorial Bento Box Grid */}
        <div className="tutorial-bento-grid mt-6 sm:mt-8 md:mt-10">
          {steps.map((step, index) => {
            const isImageLeft = step.imagePosition === 'left';
            
            return (
              <div
                key={step.number}
                className="tutorial-bento-box"
                style={{
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                }}
              >
                <div className="relative h-full flex flex-col p-6 sm:p-7 md:p-8">
                  {/* Video or Image */}
                  <div
                    className={`tutorial-bento-image flex-shrink-0 w-full rounded-md overflow-hidden mb-4 sm:mb-5 md:mb-6 ${
                      step.isVideo && step.videoId 
                        ? 'aspect-video' 
                        : 'h-[160px] sm:h-[200px] md:h-[240px] flex items-center justify-center'
                    }`}
                    style={{ backgroundColor: cardBg }}
                  >
                    {step.isVideo && step.videoId ? (
                      <iframe
                        className="w-full h-full rounded-md"
                        src={`https://www.youtube.com/embed/${step.videoId}`}
                        title={t('tutorial.tutorialVideo')}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <img
                        alt={`Tutorial step ${step.number}`}
                        className="w-full h-full object-contain pointer-events-none rounded-md"
                        src={imgImage7}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.style.backgroundColor = cardBg;
                            target.parentElement.style.display = 'flex';
                            target.parentElement.style.alignItems = 'center';
                            target.parentElement.style.justifyContent = 'center';
                            if (!target.parentElement.querySelector('.placeholder')) {
                              const placeholder = document.createElement('div');
                              placeholder.className = 'placeholder text-zinc-500 text-sm font-mono';
                              placeholder.textContent = `${t('tutorial.step')} ${step.number}`;
                              target.parentElement.appendChild(placeholder);
                            }
                          }
                        }}
                      />
                    )}
                  </div>

                  {/* Description */}
                  <div className={`tutorial-bento-content flex-1 flex items-start gap-3 sm:gap-4`}>
                    {/* Step Number Circle */}
                    <div
                      className="tutorial-bento-step-number flex-shrink-0 rounded-md w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgba(82, 221, 235, 0.15)' : 'rgba(82, 221, 235, 0.1)',
                        border: `1px solid ${theme === 'dark' ? 'rgba(82, 221, 235, 0.3)' : 'rgba(82, 221, 235, 0.2)'}`,
                      }}
                    >
                      <p className={`font-mono font-medium leading-normal text-nowrap whitespace-pre text-xs sm:text-sm md:text-base ${
                        theme === 'dark' ? 'text-cyan-300' : 'text-cyan-600'
                      }`}>
                        {step.number}
                      </p>
                    </div>
                    <p className="font-normal leading-relaxed text-sm sm:text-base md:text-lg flex-1">
                      <span className="leading-relaxed">{step.description}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Button */}
        {onCreateMockup && (
          <div className="mt-6 sm:mt-8 md:mt-10 flex justify-center">
            <button
              onClick={() => {
                onCreateMockup();
                onClose();
              }}
              className={`inline-flex items-center gap-3 px-6 py-3 sm:px-8 sm:py-4 rounded-md transition-all duration-300 font-mono text-sm sm:text-base font-semibold cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#52ddeb] hover:bg-[#52ddeb]/90 text-black shadow-lg shadow-[#52ddeb]/30'
                  : 'bg-[#52ddeb] hover:bg-[#52ddeb]/90 text-black shadow-lg shadow-[#52ddeb]/30'
              }`}
            >
              <span>{t('tutorial.createMockup')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

