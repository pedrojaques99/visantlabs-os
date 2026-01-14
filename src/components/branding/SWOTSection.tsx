import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { Textarea } from '@/components/ui/textarea';

interface SWOTSectionProps {
  swot: {
    strengths?: string[];
    weaknesses?: string[];
    opportunities?: string[];
    threats?: string[];
  };
  isEditing?: boolean;
  onContentChange?: (value: {
    strengths?: string[];
    weaknesses?: string[];
    opportunities?: string[];
    threats?: string[];
  }) => void;
}

export const SWOTSection: React.FC<SWOTSectionProps> = ({
  swot,
  isEditing = false,
  onContentChange,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [localSwot, setLocalSwot] = useState(swot);

  useEffect(() => {
    setLocalSwot(swot);
  }, [swot]);

  const updateCategory = (
    category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats',
    items: string[]
  ) => {
    const newSwot = { ...localSwot, [category]: items };
    setLocalSwot(newSwot);
    if (onContentChange) {
      onContentChange(newSwot);
    }
  };

  const handleItemChange = (
    category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats',
    index: number,
    value: string
  ) => {
    const items = localSwot[category] || [];
    const newItems = [...items];
    newItems[index] = value;
    updateCategory(category, newItems);
  };

  const handleAddItem = (category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats') => {
    const items = localSwot[category] || [];
    updateCategory(category, [...items, '']);
  };

  const handleRemoveItem = (
    category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats',
    index: number
  ) => {
    const items = localSwot[category] || [];
    const newItems = items.filter((_, i) => i !== index);
    updateCategory(category, newItems);
  };

  const renderCategory = (
    category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats',
    title: string,
    colorClass: string,
    hoverColorClass: string
  ) => {
    const items = localSwot[category] || [];
    if (!isEditing && items.length === 0) return null;

    return (
      <div
        className={`border rounded-xl p-4 ${hoverColorClass} transition-colors ${theme === 'dark'
          ? 'bg-black/40 border-neutral-800/60'
          : 'bg-neutral-100 border-neutral-300'
          }`}
      >
        <h4 className={`font-semibold ${colorClass} mb-3 font-manrope text-base`}>{title}</h4>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="relative">
              {isEditing && onContentChange ? (
                <div className="flex gap-2">
                  <Textarea
                    value={item}
                    onChange={(e) => handleItemChange(category, index, e.target.value)}
                    placeholder="Digite o item..."
                    className={`bg-transparent font-manrope text-sm min-h-[60px] pr-8 flex-1 ${theme === 'dark'
                      ? 'border-neutral-700/50 text-neutral-300'
                      : 'border-neutral-400/50 text-neutral-800'
                      }`}
                  />
                  <button
                    onClick={() => handleRemoveItem(category, index)}
                    className={`p-1 hover:bg-red-500/20 rounded transition-colors hover:text-red-400 self-start mt-2 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
                      }`}
                    title="Remover item"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className={`text-sm font-manrope leading-relaxed ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-800'
                  }`}>{item}</div>
              )}
            </div>
          ))}
          {isEditing && onContentChange && (
            <button
              onClick={() => handleAddItem(category)}
              className={`flex items-center gap-2 px-3 py-2 border hover:border-[brand-cyan]/50 hover:text-brand-cyan rounded-md text-xs font-mono transition-all duration-300 mt-2 ${theme === 'dark'
                ? 'bg-black/40 border-neutral-800/60 text-neutral-400'
                : 'bg-neutral-200 border-neutral-300 text-neutral-700'
                }`}
            >
              <Plus className="h-3 w-3" />
              Adicionar
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {renderCategory(
        'strengths',
        t('branding.strengths') || 'Strengths',
        'text-green-400',
        'hover:border-green-400/30'
      )}
      {renderCategory(
        'weaknesses',
        t('branding.weaknesses') || 'Weaknesses',
        'text-red-400',
        'hover:border-red-400/30'
      )}
      {renderCategory(
        'opportunities',
        t('branding.opportunities') || 'Opportunities',
        'text-blue-400',
        'hover:border-blue-400/30'
      )}
      {renderCategory(
        'threats',
        t('branding.threats') || 'Threats',
        'text-orange-400',
        'hover:border-orange-400/30'
      )}
    </div>
  );
};

