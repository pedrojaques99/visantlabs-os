import React, { useEffect } from 'react';
import { X } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';

// Lista de permissões do iframe do YouTube (atributo técnico, não copy).
const YOUTUBE_IFRAME_ALLOW = [
  'accelerometer',
  'autoplay',
  'clipboard-write',
  'encrypted-media',
  'gyroscope',
  'picture-in-picture',
].join('; ');

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 backdrop-blur-sm p-4 sm:p-6 py-6 sm:py-8 md:py-10 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl lg:max-w-3xl text-foreground mb-6 sm:mb-8 md:mb-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <Button
          onClick={onClose}
          className={`fixed top-4 right-4 sm:top-6 sm:right-6 md:top-8 md:right-8 z-20 transition-[color,background-color,border-color,filter] duration-300 cursor-pointer rounded-md p-2 hover:bg-accent text-muted-foreground hover:text-foreground`}
          aria-label={t('common.close')}
        >
          <X className="size-4 sm:size-5" />
        </Button>

        {/* Tutorial Bento Box Grid */}
        <div className="tutorial-bento-grid mt-6 sm:mt-8 md:mt-10">
          {steps.map((step, index) => {
            const isImageLeft = step.imagePosition === 'left';

            return (
              <div key={step.number} className="tutorial-bento-box bg-card border-border">
                <div className="relative h-full flex flex-col p-6 sm:p-7 md:p-8">
                  {/* Video or Image */}
                  <div
                    className={`tutorial-bento-image flex-shrink-0 w-full rounded-md overflow-hidden mb-4 sm:mb-5 md:mb-6 ${
                      step.isVideo && step.videoId
                        ? 'aspect-video'
                        : 'h-[160px] sm:h-[200px] md:h-[240px] flex items-center justify-center'
                    }`}
                  >
                    {step.isVideo && step.videoId ? (
                      <iframe
                        className="w-full h-full rounded-md"
                        src={`https://www.youtube.com/embed/${step.videoId}`}
                        title={t('tutorial.tutorialVideo')}
                        allow={YOUTUBE_IFRAME_ALLOW}
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
                            target.parentElement.style.display = 'flex';
                            target.parentElement.style.alignItems = 'center';
                            target.parentElement.style.justifyContent = 'center';
                            if (!target.parentElement.querySelector('.placeholder')) {
                              const placeholder = document.createElement('div');
                              placeholder.className = 'placeholder text-neutral-500 text-sm';
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
                    <div className="tutorial-bento-step-number flex-shrink-0 rounded-md w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 flex items-center justify-center bg-muted border border-border">
                      <p className="font-medium tabular-nums text-xs sm:text-sm md:text-base text-foreground">
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
            <Button
              variant="brand"
              size="lg"
              onClick={() => {
                onCreateMockup();
                onClose();
              }}
              className="font-semibold"
            >
              <span>{t('tutorial.createMockup')}</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
