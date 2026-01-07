import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { FormInput } from '../ui/form-input';
import { FormTextarea } from '../ui/form-textarea';
import type { TimelineMilestone } from '../../types';
import { Plus, Trash2 } from 'lucide-react';

interface TimelineSectionProps {
  timeline: TimelineMilestone[];
  onChange: (timeline: TimelineMilestone[]) => void;
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({
  timeline,
  onChange,
}) => {
  const { t } = useTranslation();

  const addMilestone = () => {
    onChange([
      ...timeline,
      { day: 0, title: '', description: '' },
    ]);
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
        <h3 className="text-lg font-semibold text-zinc-200 font-mono">
          {t('budget.timeline') || 'Timeline do Projeto'}
        </h3>
        <button
          onClick={addMilestone}
          className="px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[#brand-cyan]/50 rounded-xl text-brand-cyan font-mono text-sm transition-all duration-300 flex items-center gap-2"
        >
          <Plus size={16} />
          {t('budget.addMilestone') || 'Adicionar Milestone'}
        </button>
      </div>

      {timeline.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 font-mono text-sm">
          {t('budget.noMilestones') || 'Nenhum milestone adicionado ainda'}
        </div>
      ) : (
        <div className="space-y-4">
          {timeline.map((milestone, index) => (
            <div
              key={index}
              className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-mono">
                      {t('budget.day') || 'Dia'}
                    </label>
                    <FormInput
                      type="number"
                      min="0"
                      value={milestone.day}
                      onChange={(e) =>
                        updateMilestone(
                          index,
                          'day',
                          parseInt(e.target.value) || 0
                        )
                      }
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-mono">
                      {t('budget.milestoneTitle') || 'Título'}
                    </label>
                    <FormInput
                      value={milestone.title}
                      onChange={(e) =>
                        updateMilestone(index, 'title', e.target.value)
                      }
                      placeholder={t('budget.placeholders.milestoneTitle') || 'Título do milestone'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-mono">
                      {t('budget.milestoneDescription') || 'Descrição'}
                    </label>
                    <FormTextarea
                      value={milestone.description}
                      onChange={(e) =>
                        updateMilestone(index, 'description', e.target.value)
                      }
                      placeholder={t('budget.placeholders.milestoneDescription') || 'Descrição do milestone'}
                      rows={2}
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeMilestone(index)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                  title={t('budget.removeMilestone') || 'Remover milestone'}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

