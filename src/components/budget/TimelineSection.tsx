import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { FormInput } from '@/components/ui/form-input';
import { FormTextarea } from '@/components/ui/form-textarea';
import type { TimelineMilestone } from '@/types/types';
import { Plus, Trash2 } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';

interface TimelineSectionProps {
  timeline: TimelineMilestone[];
  onChange: (timeline: TimelineMilestone[]) => void;
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({ timeline, onChange }) => {
  const { t } = useTranslation();

  const addMilestone = () => {
    onChange([...timeline, { day: 0, title: '', description: '' }]);
  };

  const removeMilestone = (index: number) => {
    onChange(timeline.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: keyof TimelineMilestone, value: any) => {
    const updated = [...timeline];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-200">{t('budget.timeline')}</h3>
        <Button
          variant="brand"
          onClick={addMilestone}
          className="px-4 py-2 bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700 rounded-xl text-foreground text-sm transition-colors duration-300 flex items-center gap-2"
        >
          <Plus size={16} />
          {t('budget.addMilestone')}
        </Button>
      </div>

      {timeline.length === 0 ? (
        <div className="text-center py-8 text-neutral-500 text-sm">{t('budget.noMilestones')}</div>
      ) : (
        <div className="space-y-4">
          {timeline.map((milestone, index) => (
            <div
              key={index}
              className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">{t('budget.day')}</label>
                    <FormInput
                      type="number"
                      min="0"
                      value={milestone.day}
                      onChange={(e) => updateMilestone(index, 'day', parseInt(e.target.value) || 0)}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      {t('budget.milestoneTitle')}
                    </label>
                    <FormInput
                      value={milestone.title}
                      onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                      placeholder={t('budget.placeholders.milestoneTitle')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      {t('budget.milestoneDescription')}
                    </label>
                    <FormTextarea
                      value={milestone.description}
                      onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                      placeholder={t('budget.placeholders.milestoneDescription')}
                      rows={2}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => removeMilestone(index)}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  title={t('budget.removeMilestone')}
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
