import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export interface FloatingSupportButtonProps {
  onClick: () => void;
}

export const FloatingSupportButton: React.FC<FloatingSupportButtonProps> = ({ onClick }) => {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 w-10 h-10 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/40 hover:border-[brand-cyan]/60 text-[rgba(57,130,137,1)] rounded-md shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center group hover:scale-[1.05] opacity-70 hover:opacity-100 mt-[15px] mb-[15px]"
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

