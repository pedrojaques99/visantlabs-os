import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface BackButtonProps {
  onClick?: () => void;
  className?: string;
  label?: string;
  to?: string; // Path to navigate to (typically the previous page in breadcrumb)
}

export const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  className = '',
  label,
  to,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
      className={`flex items-center justify-center w-8 h-8 bg-black/20 backdrop-blur-sm border border-zinc-700/30 rounded-md text-zinc-400 hover:text-zinc-200 hover:border-zinc-600/30 transition-all mb-8 ${className}`}
      aria-label={label || t('common.back')}
    >
      <ArrowLeft size={16} />
    </button>
  );
};

