import React from 'react';
import { Coins, Link2 } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { getStepDependencies, getDependencyStepTitle } from '@/utils/brandingHelpers';
import { getBrandingStepCredits } from '@/utils/creditCalculator';

interface SectionHeaderProps {
  stepNumber: number;
  stepTitle: string;
  emoji: string;
  steps: Array<{ id: number; title: string }>;
  hasContent: (stepNumber: number) => boolean;
  isCollapsed: boolean;
  hasData: boolean;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  stepNumber,
  stepTitle,
  emoji,
  steps,
  hasContent,
  isCollapsed,
  hasData,
}) => {
  const { t } = useTranslation();
  const dependencies = getStepDependencies(stepNumber);
  const creditsRequired = getBrandingStepCredits(stepNumber);
  const missingDeps = dependencies.filter((dep) => !hasContent(dep));

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xl mr-2">{emoji}</div>
        <h3 className="font-medium font-manrope text-lg text-foreground">{stepTitle}</h3>
      </div>
      {!isCollapsed && !hasData && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-foreground" />
            <span>
              {creditsRequired} {creditsRequired === 1 ? 'credit' : 'credits'}
            </span>
          </div>
          {dependencies.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {t('branding.requires')}:{' '}
                <span className={missingDeps.length > 0 ? 'text-warning' : 'text-muted-foreground'}>
                  {dependencies.map((dep) => getDependencyStepTitle(dep, steps)).join(', ')}
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
