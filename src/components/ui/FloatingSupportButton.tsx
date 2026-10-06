import React from 'react';
import { MessageCircle } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';

export interface FloatingSupportButtonProps {
  onClick: () => void;
}

export const FloatingSupportButton: React.FC<FloatingSupportButtonProps> = ({ onClick }) => {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 w-10 h-10 bg-muted/50 hover:bg-accent border border-border hover:border-border-hover text-muted-foreground hover:text-foreground rounded-md shadow-md hover:shadow-lg transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 flex items-center justify-center opacity-70 hover:opacity-100 mt-[15px] mb-[15px]"
      aria-label={t('support.button')}
      title={t('support.button')}
    >
      <MessageCircle size={16} />
    </button>
  );
};
