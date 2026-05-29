import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export interface FloatingSupportButtonProps {
  onClick: () => void;
}

export const FloatingSupportButton: React.FC<FloatingSupportButtonProps> = ({ onClick }) => {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 w-10 h-10 bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 rounded-md shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center group hover:scale-[1.05] opacity-70 hover:opacity-100 mt-[15px] mb-[15px]"
      aria-label={t('support.button') || 'Support'}
      title={t('support.button') || 'Support'}
    >
      <MessageCircle
        size={16}
        className="transition-transform duration-200 group-hover:scale-[1.05]"
      />
    </button>
  );
};

