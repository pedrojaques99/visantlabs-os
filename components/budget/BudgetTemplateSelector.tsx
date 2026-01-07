import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useLayout } from '../../hooks/useLayout';
import { BUDGET_TEMPLATES } from '../../utils/budgetTemplates';
import { budgetApi, type BudgetProject } from '../../services/budgetApi';
import type { CustomPdfPreset } from '../../types';
import { ConfirmationModal } from '../ConfirmationModal';
import { Check, Upload, FileText, Edit, Trash2, Calendar } from 'lucide-react';
import { GlitchLoader } from '../ui/GlitchLoader';
import { toast } from 'sonner';

interface BudgetTemplateSelectorProps {
  selectedTemplate: string | null;
  onSelectTemplate: (templateId: string) => void;
}

export const BudgetTemplateSelector: React.FC<BudgetTemplateSelectorProps> = ({
  selectedTemplate,
  onSelectTemplate,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();

  const [presets, setPresets] = useState<CustomPdfPreset[]>([]);
  const [budgets, setBudgets] = useState<BudgetProject[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [isLoadingBudgets, setIsLoadingBudgets] = useState(false);
  const [showDeletePresetModal, setShowDeletePresetModal] = useState(false);
  const [showDeleteBudgetModal, setShowDeleteBudgetModal] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateCustomNames, setTemplateCustomNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isAuthenticated === true) {
      loadPresets();
      loadBudgets();
    }

    // Load custom template names from localStorage
    const savedNames = localStorage.getItem('budgetTemplateCustomNames');
    if (savedNames) {
      try {
        setTemplateCustomNames(JSON.parse(savedNames));
      } catch (error) {
        console.error('Error loading custom template names:', error);
      }
    }
  }, [isAuthenticated]);

  const loadPresets = async () => {
    setIsLoadingPresets(true);
    try {
      const data = await budgetApi.getPdfPresets();
      setPresets(data);
    } catch (error: any) {
      console.error('Error loading presets:', error);
      if (error?.status !== 401) {
        toast.error(t('budget.errors.failedToLoadPresets') || 'Failed to load presets');
      }
    } finally {
      setIsLoadingPresets(false);
    }
  };

  const loadBudgets = async () => {
    setIsLoadingBudgets(true);
    try {
      const data = await budgetApi.getAll();
      setBudgets(data);
    } catch (error: any) {
      console.error('Error loading budgets:', error);
      if (error?.status !== 401) {
        toast.error(t('budget.errors.failedToLoad') || 'Failed to load budgets');
      }
    } finally {
      setIsLoadingBudgets(false);
    }
  };

  const handleEditBudget = (budgetId: string) => {
    navigate(`/budget-machine?projectId=${budgetId}`);
  };

  const handleEditPreset = (presetId: string) => {
    navigate(`/budget-machine?presetId=${presetId}`);
  };

  const handleDeletePresetClick = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresetToDelete(presetId);
    setShowDeletePresetModal(true);
  };

  const handleDeleteBudgetClick = (budgetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBudgetToDelete(budgetId);
    setShowDeleteBudgetModal(true);
  };

  const handleDeletePresetConfirm = async () => {
    if (!presetToDelete) return;

    setDeletingPresetId(presetToDelete);
    try {
      await budgetApi.deletePdfPreset(presetToDelete);
      setPresets(prev => prev.filter(p => (p._id || p.id) !== presetToDelete));
      toast.success(t('budget.presetDeleted') || 'Preset deleted successfully');
    } catch (error: any) {
      console.error('Error deleting preset:', error);
      toast.error(t('budget.errors.failedToDeletePreset') || 'Failed to delete preset');
    } finally {
      setDeletingPresetId(null);
      setPresetToDelete(null);
      setShowDeletePresetModal(false);
    }
  };

  const handleDeleteBudgetConfirm = async () => {
    if (!budgetToDelete) return;

    setDeletingBudgetId(budgetToDelete);
    try {
      await budgetApi.delete(budgetToDelete);
      setBudgets(prev => prev.filter(b => b._id !== budgetToDelete));
      toast.success(t('budget.deleted') || 'Budget deleted successfully');
    } catch (error: any) {
      console.error('Error deleting budget:', error);
      toast.error(t('budget.errors.failedToDelete') || 'Failed to delete budget');
    } finally {
      setDeletingBudgetId(null);
      setBudgetToDelete(null);
      setShowDeleteBudgetModal(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateText = (text: string, maxLength: number = 60) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getTemplateDisplayName = (templateId: string, defaultName: string): string => {
    return templateCustomNames[templateId] || defaultName;
  };

  const handleTemplateNameDoubleClick = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTemplateId(templateId);
  };

  const handleTemplateNameChange = (templateId: string, newName: string) => {
    const updatedNames = { ...templateCustomNames };
    if (newName.trim()) {
      updatedNames[templateId] = newName.trim();
    } else {
      delete updatedNames[templateId];
    }
    setTemplateCustomNames(updatedNames);
    localStorage.setItem('budgetTemplateCustomNames', JSON.stringify(updatedNames));
    setEditingTemplateId(null);
  };

  const handleTemplateNameKeyDown = (templateId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTemplateNameChange(templateId, e.currentTarget.value);
    } else if (e.key === 'Escape') {
      setEditingTemplateId(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      <h2 className="text-2xl font-bold text-zinc-200 mb-6 text-center font-mono">
        {t('budget.selectTemplate')}
      </h2>

      {/* Templates Padrão */}
      <div>
        <h3 className="text-lg font-semibold text-zinc-300 mb-4 font-mono">
          {t('budget.defaultTemplates') || 'Templates Padrão'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BUDGET_TEMPLATES.filter(template => template.id !== 'custom').map((template) => (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template.id)}
              className={`relative p-6 bg-zinc-900 border rounded-xl transition-all duration-300 text-left group ${selectedTemplate === template.id
                ? 'border-[brand-cyan] bg-brand-cyan/10'
                : 'border-zinc-800 hover:border-zinc-700'
                }`}
            >
              {selectedTemplate === template.id && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-brand-cyan rounded-md flex items-center justify-center">
                  <Check size={16} className="text-black" />
                </div>
              )}
              {editingTemplateId === template.id ? (
                <input
                  type="text"
                  defaultValue={getTemplateDisplayName(template.id, template.name)}
                  onBlur={(e) => handleTemplateNameChange(template.id, e.target.value)}
                  onKeyDown={(e) => handleTemplateNameKeyDown(template.id, e)}
                  className="text-xl font-semibold text-zinc-200 mb-2 font-mono bg-transparent border-b-2 border-[brand-cyan] outline-none w-full"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <h3
                  className="text-xl font-semibold text-zinc-200 mb-2 font-mono cursor-text"
                  onDoubleClick={(e) => handleTemplateNameDoubleClick(template.id, e)}
                >
                  {getTemplateDisplayName(template.id, template.name)}
                </h3>
              )}
              <p className="text-sm text-zinc-400 font-mono">
                {template.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Meus Templates PDF */}
      {isAuthenticated === true && (
        <div>
          <h3 className="text-lg font-semibold text-zinc-300 mb-4 font-mono">
            {t('budget.myPdfTemplates') || 'Meus Templates PDF'}
          </h3>
          {isLoadingPresets ? (
            <div className="flex items-center justify-center py-8">
              <GlitchLoader size={24} color="brand-cyan" />
            </div>
          ) : presets.length === 0 ? (
            <p className="text-sm text-zinc-500 font-mono text-center py-4">
              {t('budget.noPresets') || 'Nenhum template PDF salvo ainda'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {presets.map((preset) => {
                const presetId = preset._id || preset.id || '';
                return (
                  <div
                    key={presetId}
                    className="relative p-6 bg-zinc-900 border border-zinc-800 rounded-xl transition-all duration-300 group"
                  >
                    <div className="absolute top-4 right-4">
                      <Upload size={20} className="text-brand-cyan" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-zinc-200 mb-2 font-mono line-clamp-2">
                        {truncateText(preset.name, 50)}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mb-4">
                        <Calendar size={14} />
                        <span>{formatDate(preset.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={() => handleEditPreset(presetId)}
                        className="flex-1 px-4 py-2 bg-black/40 border border-zinc-800/60 hover:border-[brand-cyan]/50 hover:text-brand-cyan rounded-xl text-sm font-mono text-zinc-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Edit size={14} />
                        {t('budget.edit')}
                      </button>
                      <button
                        onClick={(e) => handleDeletePresetClick(presetId, e)}
                        disabled={deletingPresetId === presetId}
                        className="px-4 py-2 bg-black/40 border border-zinc-800/60 hover:border-red-500/50 hover:text-red-400 rounded-xl text-sm font-mono text-zinc-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {deletingPresetId === presetId ? (
                          <GlitchLoader size={14} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Meus Budgets */}
      {isAuthenticated === true && (
        <div>
          <h3 className="text-lg font-semibold text-zinc-300 mb-4 font-mono">
            {t('budget.myBudgets') || 'Meus Budgets'}
          </h3>
          {isLoadingBudgets ? (
            <div className="flex items-center justify-center py-8">
              <GlitchLoader size={24} color="brand-cyan" />
            </div>
          ) : budgets.length === 0 ? (
            <p className="text-sm text-zinc-500 font-mono text-center py-4">
              {t('budget.noBudgets') || 'Nenhum orçamento ainda'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {budgets.map((budget) => (
                <div
                  key={budget._id}
                  className="relative p-6 bg-zinc-900 border border-zinc-800 rounded-xl transition-all duration-300 group"
                >
                  <div className="absolute top-4 left-4">
                    <FileText size={20} className="text-brand-cyan" />
                  </div>
                  <div className="pr-12">
                    <h3 className="text-xl font-semibold text-zinc-200 mb-2 font-mono line-clamp-2">
                      {truncateText(budget.name || budget.projectDescription, 50)}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mb-4">
                      <Calendar size={14} />
                      <span>{formatDate(budget.createdAt)}</span>
                    </div>
                    <p className="text-sm text-zinc-400 font-mono mb-4 line-clamp-2">
                      {truncateText(budget.clientName, 80)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => handleEditBudget(budget._id)}
                      className="flex-1 px-4 py-2 bg-black/40 border border-zinc-800/60 hover:border-[brand-cyan]/50 hover:text-brand-cyan rounded-xl text-sm font-mono text-zinc-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Edit size={14} />
                      {t('budget.edit')}
                    </button>
                    <button
                      onClick={(e) => handleDeleteBudgetClick(budget._id, e)}
                      disabled={deletingBudgetId === budget._id}
                      className="px-4 py-2 bg-black/40 border border-zinc-800/60 hover:border-red-500/50 hover:text-red-400 rounded-xl text-sm font-mono text-zinc-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {deletingBudgetId === budget._id ? (
                        <GlitchLoader size={14} />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Preset Modal */}
      <ConfirmationModal
        isOpen={showDeletePresetModal}
        onClose={() => {
          setShowDeletePresetModal(false);
          setPresetToDelete(null);
        }}
        onConfirm={handleDeletePresetConfirm}
        title={t('budget.confirmDeletePresetTitle') || 'Excluir Template'}
        message={t('budget.confirmDeletePreset') || 'Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.'}
        confirmText={t('budget.delete') || 'Excluir'}
        cancelText={t('common.cancel') || 'Cancelar'}
        variant="danger"
      />

      {/* Delete Budget Modal */}
      <ConfirmationModal
        isOpen={showDeleteBudgetModal}
        onClose={() => {
          setShowDeleteBudgetModal(false);
          setBudgetToDelete(null);
        }}
        onConfirm={handleDeleteBudgetConfirm}
        title={t('budget.confirmDeleteTitle') || 'Excluir Orçamento'}
        message={t('budget.confirmDelete') || 'Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.'}
        confirmText={t('budget.delete') || 'Excluir'}
        cancelText={t('common.cancel') || 'Cancelar'}
        variant="danger"
      />
    </div>
  );
};

