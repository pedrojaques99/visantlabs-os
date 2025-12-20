import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { FormInput } from '../ui/form-input';
import type { BudgetLinks } from '../../types';
import { Globe, Instagram, MessageCircle } from 'lucide-react';

interface LinksSectionProps {
  links: BudgetLinks;
  onChange: (links: BudgetLinks) => void;
}

export const LinksSection: React.FC<LinksSectionProps> = ({
  links,
  onChange,
}) => {
  const { t } = useTranslation();

  const updateLink = (field: keyof BudgetLinks, value: string) => {
    onChange({ ...links, [field]: value });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-zinc-200 font-mono">
        {t('budget.links')}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-mono flex items-center gap-2">
            <Globe size={14} />
            {t('budget.website')}
          </label>
          <FormInput
            type="url"
            value={links.website || ''}
            onChange={(e) => updateLink('website', e.target.value)}
            placeholder={t('budget.placeholders.website')}
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-mono flex items-center gap-2">
            <Instagram size={14} />
            {t('budget.instagram')}
          </label>
          <FormInput
            value={links.instagram || ''}
            onChange={(e) => updateLink('instagram', e.target.value)}
            placeholder={t('budget.placeholders.instagram')}
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-mono flex items-center gap-2">
            <MessageCircle size={14} />
            {t('budget.whatsapp')}
          </label>
          <FormInput
            value={links.whatsapp || ''}
            onChange={(e) => updateLink('whatsapp', e.target.value)}
            placeholder={t('budget.placeholders.whatsapp')}
          />
        </div>
      </div>
    </div>
  );
};

