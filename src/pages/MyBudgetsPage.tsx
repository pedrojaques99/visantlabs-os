import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { budgetApi, type BudgetProject } from '../services/budgetApi';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { AuthModal } from '../components/AuthModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { GlassPanel } from '../components/ui/GlassPanel';
import { ErrorState } from '@/components/ui/ErrorState';
import { PremiumButton } from '../components/ui/PremiumButton';
import { toast } from 'sonner';
import { FileText, Calendar, Eye, Trash2, Pickaxe, Edit } from '@/lib/ui/icons';
import type { CustomPdfPreset } from '../types/types';
import { SEO } from '../components/SEO';
import { Button } from '@/components/ui/button';
import { formatDateShort } from '@/utils/localeUtils';
import { useInAppShell } from '@/components/shell/InAppShellContext';
import { cn } from '@/lib/utils';

export const MyBudgetsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();
  const inShell = useInAppShell();
  const [budgets, setBudgets] = useState<BudgetProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);
  const [presets, setPresets] = useState<CustomPdfPreset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [showDeletePresetModal, setShowDeletePresetModal] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [presetLoadError, setPresetLoadError] = useState(false);

  useEffect(() => {
    if (isAuthenticated === false) {
      setShowAuthModal(true);
    } else if (isAuthenticated === true) {
      loadBudgets();
      loadPresets();
    }
  }, [isAuthenticated]);

  const loadBudgets = async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const data = await budgetApi.getAll();
      setBudgets(data);
    } catch (error: any) {
      console.error('Error loading budgets:', error);
      if (error?.status === 401) {
        setShowAuthModal(true);
      } else {
        setLoadError(true);
        toast.error(t('budget.errors.failedToLoad') || 'Failed to load budgets');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadPresets = async () => {
    setIsLoadingPresets(true);
    setPresetLoadError(false);
    try {
      const data = await budgetApi.getPdfPresets();
      setPresets(data);
    } catch (error: any) {
      console.error('Error loading presets:', error);
      if (error?.status !== 401) {
        setPresetLoadError(true);
        toast.error(t('budget.errors.failedToLoadPresets') || 'Failed to load presets');
      }
    } finally {
      setIsLoadingPresets(false);
    }
  };

  const handleView = (budget: BudgetProject) => {
    if (budget._id && budget._id.trim() !== '') {
      navigate(`/budget-machine?projectId=${budget._id}`);
    } else {
      toast.error(t('my.budgets.invalid_budget_id'));
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBudgetToDelete(id);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!budgetToDelete) return;

    setDeletingId(budgetToDelete);
    try {
      await budgetApi.delete(budgetToDelete);
      setBudgets((prev) => prev.filter((b) => b._id !== budgetToDelete));
      toast.success(t('budget.deleted') || 'Budget deleted successfully');
    } catch (error: any) {
      console.error('Error deleting budget:', error);
      toast.error(t('budget.errors.failedToDelete') || 'Failed to delete budget');
    } finally {
      setDeletingId(null);
      setBudgetToDelete(null);
      setShowDeleteModal(false);
    }
  };

  const handleEditPreset = (presetId: string) => {
    navigate(`/budget-machine?presetId=${presetId}`);
  };

  const handleDeletePresetClick = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresetToDelete(presetId);
    setShowDeletePresetModal(true);
  };

  const handleDeletePresetConfirm = async () => {
    if (!presetToDelete) return;

    setDeletingPresetId(presetToDelete);
    try {
      await budgetApi.deletePdfPreset(presetToDelete);
      setPresets((prev) => prev.filter((p) => (p._id || p.id) !== presetToDelete));
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

  const formatDate = (dateString: string) => formatDateShort(dateString);

  const truncateText = (text: string, maxLength: number = 120) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-neutral-950 text-neutral-300 relative',
          inShell ? 'min-h-full' : 'min-h-screen',
          inShell ? 'pt-6' : 'pt-14'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-neutral-800/60 rounded-md p-6">
                <SkeletonLoader height="1.5rem" className="w-3/4 mb-2" />
                <SkeletonLoader height="1rem" className="w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={t('budget.myBudgets.seoTitle')}
        description={t('budget.myBudgets.seoDescription')}
        noindex={true}
      />
      <div
        className={cn(
          'bg-neutral-950 text-neutral-300 relative overflow-hidden',
          inShell ? 'min-h-full' : 'min-h-screen',
          inShell ? 'pt-6' : 'pt-14'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 relative z-10">
          {/* Actions */}
          <div className="flex items-center justify-end gap-2 mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate('/budget-machine')}
              className="px-4 py-2 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Pickaxe className="h-4 w-4" />
              {t('budget.createNew') || 'Create New'}
            </Button>
          </div>

          {/* Presets Salvos Section */}
          {isAuthenticated === true && (
            <GlassPanel padding="md" className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg md:text-xl font-semibold font-manrope text-neutral-200 mb-1">
                    {t('budget.myPdfTemplates') || 'Presets Salvos'}
                  </h2>
                  <p className="text-sm text-neutral-400">
                    {isLoadingPresets
                      ? 'Carregando...'
                      : presets.length === 0
                        ? t('budget.noPresets') || 'Nenhum preset salvo ainda'
                        : `${presets.length} ${presets.length === 1 ? 'preset' : 'presets'}`}
                  </p>
                </div>
              </div>

              {isLoadingPresets ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-neutral-600 border-t-transparent rounded-md animate-spin" />
                    <span className="text-sm text-neutral-400">
                      {t('my.budgets.carregando_presets')}
                    </span>
                  </div>
                </div>
              ) : presetLoadError && presets.length === 0 ? (
                <ErrorState
                  title={t('budget.errors.failedToLoadPresets') || 'Failed to load presets'}
                  description={t('budget.errors.loadRetry') || 'Your presets are safe. Try loading again.'}
                  onRetry={loadPresets}
                />
              ) : presets.length === 0 ? (
                <div className="text-center py-8">
                  <FileText size={48} className="text-neutral-700 mx-auto mb-3" strokeWidth={1} />
                  <p className="text-sm text-neutral-500">
                    {t('budget.noPresets') || 'Nenhum preset salvo ainda'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {presets.map((preset) => {
                    const presetId = preset._id || preset.id || '';
                    return (
                      <GlassPanel
                        key={presetId}
                        padding="none"
                        className="p-6 md:p-8 hover:border-neutral-700/60 transition-colors duration-300 bg-neutral-900"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-5 w-5 text-neutral-500" />
                              <h3 className="font-semibold text-neutral-200 font-manrope text-lg line-clamp-2">
                                {truncateText(preset.name, 60)}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-neutral-400 mb-3">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{formatDate(preset.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => handleEditPreset(presetId)}
                            className="flex-1 px-4 py-2 bg-neutral-950/70 border border-neutral-800/60 hover:border-neutral-700 rounded-md text-sm text-neutral-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Edit className="h-4 w-4" />
                            {t('common.edit') || 'Edit'}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={(e) => handleDeletePresetClick(presetId, e)}
                            disabled={deletingPresetId === presetId}
                            className="px-4 py-2 bg-neutral-950/70 border border-neutral-800/60 hover:border-destructive/50 hover:text-destructive rounded-md text-sm text-neutral-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </GlassPanel>
                    );
                  })}
                </div>
              )}
            </GlassPanel>
          )}

          {/* Budgets Grid */}
          {loadError && budgets.length === 0 ? (
            <ErrorState
              title={t('budget.errors.failedToLoad') || 'Failed to load budgets'}
              description={t('budget.errors.loadRetry') || 'Your budgets are safe. Try loading again.'}
              onRetry={loadBudgets}
            />
          ) : budgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <FileText size={64} className="text-neutral-700 mb-4" strokeWidth={1} />
              <h2 className="text-lg font-semibold text-neutral-200 mb-1.5">
                {t('budget.emptyTitle') || 'No budgets yet'}
              </h2>
              <p className="text-sm text-neutral-500 mb-6">
                {t('budget.emptyDescription') || 'Create your first budget to see it here.'}
              </p>
              <PremiumButton
                onClick={() => navigate('/budget-machine')}
                className="max-w-xs h-12"
                icon={Pickaxe}
              >
                {t('budget.createFirst') || 'Create Your First Budget'}
              </PremiumButton>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {budgets.map((budget) => (
                <GlassPanel
                  key={budget._id}
                  padding="none"
                  className="p-6 md:p-8 hover:border-neutral-700/60 transition-colors duration-300 group cursor-pointer bg-[#141414]"
                  onClick={() => handleView(budget)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-neutral-500" />
                        <h3 className="font-semibold text-neutral-200 font-manrope text-lg line-clamp-2">
                          {budget.name
                            ? truncateText(budget.name, 60)
                            : truncateText(budget.projectDescription, 60)}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-400 mb-3">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(budget.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-neutral-400 mb-4 line-clamp-3">
                    {truncateText(budget.clientName, 120)}
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(budget);
                      }}
                      className="flex-1 px-4 py-2 bg-neutral-950/70 border border-neutral-800/60 hover:border-neutral-700 rounded-xl text-sm text-neutral-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Eye className="h-4 w-4" />
                      {t('budget.view') || 'View'}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={(e) => handleDeleteClick(budget._id, e)}
                      disabled={deletingId === budget._id}
                      className="px-4 py-2 bg-neutral-950/70 border border-neutral-800/60 hover:border-destructive/50 hover:text-destructive rounded-xl text-sm text-neutral-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </GlassPanel>
              ))}
            </div>
          )}
        </div>

        {/* Auth Modal */}
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={async () => {
              setShowAuthModal(false);
              await loadBudgets();
            }}
            isSignUp={false}
          />
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setBudgetToDelete(null);
          }}
          onConfirm={handleDeleteConfirm}
          title={t('budget.confirmDeleteTitle')}
          message={t('budget.confirmDelete')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          variant="danger"
        />

        {/* Delete Preset Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeletePresetModal}
          onClose={() => {
            setShowDeletePresetModal(false);
            setPresetToDelete(null);
          }}
          onConfirm={handleDeletePresetConfirm}
          title={t('budget.confirmDeletePresetTitle') || 'Excluir Preset'}
          message={
            t('budget.confirmDeletePreset') ||
            'Tem certeza que deseja excluir este preset? Esta ação não pode ser desfeita.'
          }
          confirmText={t('common.delete') || 'Excluir'}
          cancelText={t('common.cancel') || 'Cancelar'}
          variant="danger"
        />
      </div>
    </>
  );
};
