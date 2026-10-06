import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useInAppShell } from '../shell/InAppShellContext';

interface BackButtonProps {
  onClick?: () => void;
  className?: string;
  label?: string;
  to?: string; // Path to navigate to (typically the previous page in breadcrumb)
}

export const BackButton: React.FC<BackButtonProps> = ({ onClick, className = '', label, to }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Dentro do AppShell a navegação é o rail — o back de página é redundante. P1.
  const inShell = useInAppShell();
  if (inShell) return null;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to); // Navigate to breadcrumb path
    } else {
      navigate(-1); // Fallback: go back using React Router
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center justify-center w-8 h-8 bg-background/20 border border-border rounded-md text-muted-foreground hover:text-foreground hover:border-border-hover transition-colors mb-8',
        className
      )}
      aria-label={label || t('common.back')}
    >
      <ArrowLeft size={16} />
    </button>
  );
};
