import type { BudgetTemplate } from '../types/types';

export const BUDGET_TEMPLATES: BudgetTemplate[] = [
  {
    id: 'visant',
    name: 'Visant',
    description: 'Layout profissional baseado no design Visant',
    layout: 'visant',
  },
  {
    id: 'custom',
    name: 'Layout Custom',
    description: 'Use seu próprio PDF e mapeie os campos do formulário',
    layout: 'custom',
  },
];

export const getTemplateById = (id: string): BudgetTemplate | undefined => {
  return BUDGET_TEMPLATES.find(t => t.id === id);
};

