import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { budgetApi, type BudgetProject } from '../services/budgetApi';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { AuthModal } from '../components/AuthModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { GlassPanel } from '../components/ui/GlassPanel';
import { MediaTile } from '../components/ui/MediaTile';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from 'sonner';
import { FileText, Trash2, Pickaxe } from '@/lib/ui/icons';
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
      // Sem isso o skeleton ficava pra sempre e o AuthModal (que só existe no
      // ramo carregado) nunca aparecia.
      setIsLoading(false);
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
        toast.error(t('budget.errors.failedToLoad'));
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
        toast.error(t('budget.errors.failedToLoadPresets'));
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
      toast.success(t('budget.deleted'));
    } catch (error: any) {
      console.error('Error deleting budget:', error);
      toast.error(t('budget.errors.failedToDelete'));
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
      toast.success(t('budget.presetDeleted'));
    } catch (error: any) {
      console.error('Error deleting preset:', error);
      toast.error(t('budget.errors.failedToDeletePreset'));
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
          'bg-background text-muted-foreground relative',
          inShell ? 'min-h-full' : 'min-h-screen',
          inShell ? 'pt-6' : 'pt-14'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-6">
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
        title={t('budget.myBudgetsSeoTitle')}
        description={t('budget.myBudgetsSeoDescription')}
        noindex={true}
      />
      <div
        className={cn(
          'bg-background text-muted-foreground relative overflow-hidden',
          inShell ? 'min-h-full' : 'min-h-screen',
          inShell ? 'pt-6' : 'pt-14'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 relative z-10">
          {/* Actions */}
          <div className="flex items-center justify-end gap-2 mb-6">
            <Button variant="primary" onClick={() => navigate('/budget-machine')}>
              <Pickaxe className="h-4 w-4" />
              {t('budget.createNew')}
            </Button>
          </div>

          {/* Presets Salvos Section */}
          {isAuthenticated === true && (
            <GlassPanel padding="md" className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg md:text-xl font-semibold text-foreground mb-1">
                    {t('budget.myPdfTemplates')}
                  </h2>
                  {/* Contagem só quando há modelos: com zero, o vazio abaixo já diz. */}
                  {!isLoadingPresets && presets.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {presets.length === 1
                        ? t('budget.presetsCountOne')
                        : t('budget.presetsCountMany', { count: presets.length })}
                    </p>
                  )}
                </div>
              </div>

              {isLoadingPresets ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      {t('my.budgets.carregando_presets')}
                    </span>
                  </div>
                </div>
              ) : presetLoadError && presets.length === 0 ? (
                <ErrorState
                  title={t('budget.errors.failedToLoadPresets')}
                  description={t('budget.errors.loadRetry')}
                  onRetry={loadPresets}
                />
              ) : presets.length === 0 ? (
                <div className="text-center py-8">
                  <FileText
                    size={40}
                    className="text-muted-foreground mx-auto mb-3"
                    strokeWidth={1}
                  />
                  <p className="text-sm text-muted-foreground">{t('budget.noPresets')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {presets.map((preset) => {
                    const presetId = preset._id || preset.id || '';
                    const name = truncateText(preset.name, 60);
                    return (
                      <MediaTile
                        key={presetId}
                        alt={name}
                        aspectRatio="16 / 10"
                        fallbackIcon={FileText}
                        actionLabel={name}
                        onClick={() => handleEditPreset(presetId)}
                        title={name}
                        subtitle={formatDate(preset.createdAt)}
                        actions={
                          <Button
                            variant="danger"
                            size="icon-sm"
                            onClick={(e) => handleDeletePresetClick(presetId, e)}
                            disabled={deletingPresetId === presetId}
                            aria-label={t('common.delete')}
                            title={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </GlassPanel>
          )}

          {/* Budgets Grid */}
          {loadError && budgets.length === 0 ? (
            <ErrorState
              title={t('budget.errors.failedToLoad')}
              description={t('budget.errors.loadRetry')}
              onRetry={loadBudgets}
            />
          ) : budgets.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t('budget.emptyTitle')}
              description={t('budget.emptyDescription')}
              actionLabel={t('budget.createFirst')}
              onAction={() => navigate('/budget-machine')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {budgets.map((budget) => {
                const name = budget.name
                  ? truncateText(budget.name, 60)
                  : truncateText(budget.projectDescription, 60);
                return (
                  <MediaTile
                    key={budget._id}
                    alt={name}
                    aspectRatio="16 / 10"
                    fallbackIcon={FileText}
                    actionLabel={name}
                    onClick={() => handleView(budget)}
                    title={name}
                    subtitle={formatDate(budget.createdAt)}
                    meta={
                      budget.clientName ? (
                        <span className="line-clamp-2">{truncateText(budget.clientName, 120)}</span>
                      ) : undefined
                    }
                    actions={
                      <Button
                        variant="danger"
                        size="icon-sm"
                        onClick={(e) => handleDeleteClick(budget._id, e)}
                        disabled={deletingId === budget._id}
                        aria-label={t('common.delete')}
                        title={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                );
              })}
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
          title={t('budget.confirmDeletePresetTitle')}
          message={t('budget.confirmDeletePreset')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          variant="danger"
        />
      </div>
    </>
  );
};
