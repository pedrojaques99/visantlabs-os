import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

type ValidationType = 'error' | 'success' | 'warning' | 'info';

interface ValidationMessageProps {
  type: ValidationType;
  message: string;
  suggestion?: string;
  onDismiss?: () => void;
  className?: string;
}

const typeStyles: Record<ValidationType, { icon: React.ReactNode; colors: string }> = {
  error: {
    icon: <AlertCircle size={16} />,
    colors: 'bg-red-500/10 border-red-500/30 text-red-400',
  },
  success: {
    icon: <CheckCircle size={16} />,
    colors: 'bg-green-500/10 border-green-500/30 text-green-400',
  },
  warning: {
    icon: <AlertCircle size={16} />,
    colors: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  },
  info: {
    icon: <Info size={16} />,
    colors: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  },
};

export const ValidationMessage: React.FC<ValidationMessageProps> = ({
  type,
  message,
  suggestion,
  onDismiss,
  className = '',
}) => {
  const { t } = useTranslation();
  const styles = typeStyles[type];

  return (
    <div
      className={`${styles.colors} border rounded-md p-3 text-sm font-mono flex items-start gap-2 animate-fade-in ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
      <div className="flex-1 min-w-0">
        <p>{message}</p>
        {suggestion && (
          <p className="mt-1 text-xs opacity-80">{suggestion}</p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-current rounded"
          aria-label={t('common.dismissMessage')}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

