import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { budgetApi, type BudgetProject } from '../services/budgetApi';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { AuthModal } from '../components/AuthModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import {
  BreadcrumbWithBack,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/BreadcrumbWithBack";
import { toast } from 'sonner';
import { FileText, Calendar, Eye, Trash2, Pickaxe, Edit, Layout } from 'lucide-react';
import type { CustomPdfPreset } from '../types/types';
import { SEO } from '../components/SEO';

export const MyBudgetsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();
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
    try {
      const data = await budgetApi.getAll();
      setBudgets(data);
    } catch (error: any) {
      console.error('Error loading budgets:', error);
      if (error?.status === 401) {
        setShowAuthModal(true);
      } else {
        toast.error(t('budget.errors.failedToLoad') || 'Failed to load budgets');
      }
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleView = (budget: BudgetProject) => {
    if (budget._id && budget._id.trim() !== '') {
      navigate(`/budget-machine?projectId=${budget._id}`);
    } else {
      toast.error('Invalid budget ID');
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
      setBudgets(prev => prev.filter(b => b._id !== budgetToDelete));
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateText = (text: string, maxLength: number = 120) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-14 relative">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
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
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-14 relative overflow-hidden">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-4 md:py-6 relative z-10">
          {/* Breadcrumb with Back Button */}
          <div className="mb-6">
            <BreadcrumbWithBack to="/budget-machine">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/budget-machine">Budget Machine</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>My Budgets</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </BreadcrumbWithBack>
          </div>
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-neutral-300 mb-2">
                {t('budget.myBudgets') || 'My Budgets'}
              </h1>
              <p className="text-neutral-500 font-mono text-sm md:text-base">
                {budgets.length === 0
                  ? t('budget.noBudgets') || 'No budgets yet'
                  : `${budgets.length} ${budgets.length === 1 ? 'budget' : 'budgets'}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => navigate('/budget-machine')}
                className="px-3 py-1.5 bg-neutral-950/70 border border-neutral-800/60 hover:border-brand-cyan/50 hover:text-brand-cyan rounded-md text-xs font-mono text-neutral-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Layout className="h-3.5 w-3.5" />
                {t('budget.selectTemplate') || 'Ver Templates'}
              </button>
              <button
                onClick={() => navigate('/budget-machine')}
                className="px-4 py-2 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Pickaxe className="h-4 w-4" />
                {t('budget.createNew') || 'Create New'}
              </button>
            </div>
          </div>

          {/* Presets Salvos Section */}
          {isAuthenticated === true && (
            <section className="bg-card border border-neutral-800/60 rounded-md p-4 md:p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg md:text-xl font-semibold font-manrope text-neutral-200 mb-1">
                    {t('budget.myPdfTemplates') || 'Presets Salvos'}
                  </h2>
                  <p className="text-sm text-neutral-400 font-mono">
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
                    <div className="h-4 w-4 border-2 border-[brand-cyan] border-t-transparent rounded-md animate-spin" />
                    <span className="text-sm text-neutral-400 font-mono">Carregando presets...</span>
                  </div>
                </div>
              ) : presets.length === 0 ? (
                <div className="text-center py-8">
                  <FileText size={48} className="text-neutral-700 mx-auto mb-3" strokeWidth={1} />
                  <p className="text-sm text-neutral-500 font-mono">
                    {t('budget.noPresets') || 'Nenhum preset salvo ainda'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {presets.map((preset) => {
                    const presetId = preset._id || preset.id || '';
                    return (
                      <div
                        key={presetId}
                        className="bg-neutral-900 border border-neutral-800/60 rounded-md p-6 md:p-8 hover:border-neutral-700/60 transition-all duration-300"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-5 w-5 text-brand-cyan" />
                              <h3 className="font-semibold text-neutral-200 font-manrope text-lg line-clamp-2">
                                {truncateText(preset.name, 60)}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-3">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{formatDate(preset.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditPreset(presetId)}
                            className="flex-1 px-4 py-2 bg-neutral-950/70 border border-neutral-800/60 hover:border-brand-cyan/50 hover:text-brand-cyan rounded-md text-sm font-mono text-neutral-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Edit className="h-4 w-4" />
                            {t('budget.edit') || 'Edit'}
                          </button>
                          <button
                            onClick={(e) => handleDeletePresetClick(presetId, e)}
                            disabled={deletingPresetId === presetId}
                            className="px-4 py-2 bg-neutral-950/70 border border-neutral-800/60 hover:border-red-500/50 hover:text-red-400 rounded-md text-sm font-mono text-neutral-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Budgets Grid */}
          {budgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <FileText size={64} className="text-neutral-700 mb-4" strokeWidth={1} />
              <h2 className="text-xl font-semibold font-mono uppercase text-neutral-500 mb-2">
                {t('budget.emptyTitle') || 'NO BUDGETS YET'}
              </h2>
              <p className="text-sm text-neutral-600 font-mono mb-6">
                {t('budget.emptyDescription') || 'Create your first budget to see it here.'}
              </p>
              <button
                onClick={() => navigate('/budget-machine')}
                className="px-6 py-3 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-cyan/20"
              >
                <Pickaxe className="h-4 w-4" />
                {t('budget.createFirst') || 'Create Your First Budget'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {budgets.map((budget) => (
                <div
                  key={budget._id}
                  className="bg-[#141414] border border-neutral-800/60 rounded-md p-6 md:p-8 hover:border-neutral-700/60 transition-all duration-300 group cursor-pointer"
                  onClick={() => handleView(budget)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-brand-cyan" />
                        <h3 className="font-semibold text-neutral-200 font-manrope text-lg line-clamp-2">
                          {budget.name ? truncateText(budget.name, 60) : truncateText(budget.projectDescription, 60)}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-3">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(budget.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-neutral-400 font-mono mb-4 line-clamp-3">
                    {truncateText(budget.clientName, 120)}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(budget);
                      }}
                      className="flex-1 px-4 py-2 bg-neutral-950/70 border border-neutral-800/60 hover:border-[brand-cyan]/50 hover:text-brand-cyan rounded-xl text-sm font-mono text-neutral-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Eye className="h-4 w-4" />
                      {t('budget.view') || 'View'}
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(budget._id, e)}
                      disabled={deletingId === budget._id}
                      className="px-4 py-2 bg-neutral-950/70 border border-neutral-800/60 hover:border-red-500/50 hover:text-red-400 rounded-xl text-sm font-mono text-neutral-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
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
          confirmText={t('budget.delete')}
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
          message={t('budget.confirmDeletePreset') || 'Tem certeza que deseja excluir este preset? Esta ação não pode ser desfeita.'}
          confirmText={t('budget.delete') || 'Excluir'}
          cancelText={t('common.cancel') || 'Cancelar'}
          variant="danger"
        />
      </div>
    </>
  );
};

