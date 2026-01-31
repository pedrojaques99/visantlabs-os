import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import type { BudgetData } from '@/types/types';
import { Palette, X, Save, FolderOpen, Trash2 } from 'lucide-react';
import { BrandCustomizationSection } from './BrandCustomizationSection';
import { toast } from 'sonner';

interface BrandCustomizationPanelProps {
  data: BudgetData;
  budgetId?: string;
  onDataChange: (data: Partial<BudgetData>) => void;
  renderButton?: boolean;
  buttonClassName?: string;
}

const STORAGE_KEY = 'brand-customization-panel-open';
const TEMPLATES_STORAGE_KEY = 'brand-customization-templates';

interface BrandTemplate {
  id: string;
  name: string;
  brandName: string;
  brandColors: string[];
  brandLogo?: string;
  brandBackgroundColor?: string;
  brandAccentColor?: string;
  contentWidth?: number;
  contentHeight?: number;
  createdAt: string;
}

export const BrandCustomizationPanel: React.FC<BrandCustomizationPanelProps> = ({
  data,
  budgetId,
  onDataChange,
  renderButton = true,
  buttonClassName = '',
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : false;
  });
  const [templates, setTemplates] = useState<BrandTemplate[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showLoadModal, setShowLoadModal] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(isOpen));
  }, [isOpen]);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    try {
      const saved = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (saved) {
        setTemplates(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const saveTemplate = () => {
    if (!templateName.trim()) {
      toast.error('Digite um nome para o template');
      return;
    }

    const template: BrandTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      brandName: data.brandName,
      brandColors: [...data.brandColors],
      brandLogo: data.brandLogo,
      brandBackgroundColor: data.brandBackgroundColor,
      brandAccentColor: data.brandAccentColor,
      contentWidth: data.contentWidth,
      contentHeight: data.contentHeight,
      createdAt: new Date().toISOString(),
    };

    const updatedTemplates = [...templates, template];
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
    setTemplates(updatedTemplates);
    setShowSaveModal(false);
    setTemplateName('');
    toast.success('Template salvo com sucesso!');
  };

  const loadTemplate = (template: BrandTemplate) => {
    onDataChange({
      brandName: template.brandName,
      brandColors: template.brandColors,
      brandLogo: template.brandLogo,
      brandBackgroundColor: template.brandBackgroundColor,
      brandAccentColor: template.brandAccentColor,
      contentWidth: template.contentWidth,
      contentHeight: template.contentHeight,
    });
    setShowLoadModal(false);
    toast.success(`Template "${template.name}" carregado!`);
  };

  const deleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTemplates = templates.filter(t => t.id !== id);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
    setTemplates(updatedTemplates);
    toast.success('Template removido');
  };

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  const handleBrandNameChange = (name: string) => {
    onDataChange({ brandName: name });
  };

  const handleBrandColorsChange = (colors: string[]) => {
    onDataChange({ brandColors: colors });
  };

  const handleBrandLogoChange = (logo: string | undefined) => {
    onDataChange({ brandLogo: logo });
  };

  const handleBrandBackgroundColorChange = (color: string | undefined) => {
    onDataChange({ brandBackgroundColor: color });
  };

  const handleBrandAccentColorChange = (color: string | undefined) => {
    onDataChange({ brandAccentColor: color });
  };

  const handleContentWidthChange = (width: number) => {
    onDataChange({ contentWidth: width });
  };

  const handleContentHeightChange = (height: number) => {
    if (height <= 0 || isNaN(height)) {
      onDataChange({ contentHeight: undefined });
    } else {
      onDataChange({ contentHeight: height });
    }
  };

  return (
    <>
      {/* Toggle Button */}
      {renderButton && (
        <button
          onClick={togglePanel}
          className={`
            flex items-center justify-center
            p-2
            bg-neutral-900 border border-neutral-800 rounded-xl
            text-neutral-200 hover:text-brand-cyan
            hover:bg-neutral-900/90 hover:border-[brand-cyan]/50
            transition-all duration-300
            shadow-lg
            ${isOpen ? 'hidden' : ''}
            ${buttonClassName}
          `}
          aria-label={t('budget.brandCustomization') || 'Brand Customization'}
          title={t('budget.brandCustomization') || 'Customização da Marca'}
        >
          <Palette size={18} />
        </button>
      )}

      {/* Floating Panel */}
      <div
        className={`
          fixed top-20 right-0 z-50
          h-[calc(100vh-5rem)]
          bg-neutral-900 border-l border-neutral-800
          shadow-2xl
          transition-all duration-300 ease-in-out
          flex flex-col
          ${isOpen ? 'w-full sm:w-96 translate-x-0' : 'w-0 translate-x-full'}
          overflow-hidden
        `}
      >
        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-800 bg-neutral-900">
            <h3 className="text-lg font-semibold text-neutral-200 font-mono">
              {t('budget.brandCustomization') || 'Customização da Marca'}
            </h3>
            <button
              onClick={togglePanel}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-md transition-colors"
              aria-label="Close panel"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6">
            <BrandCustomizationSection
              brandName={data.brandName}
              brandColors={data.brandColors}
              brandLogo={data.brandLogo}
              brandBackgroundColor={data.brandBackgroundColor}
              brandAccentColor={data.brandAccentColor}
              budgetId={budgetId}
              onBrandNameChange={handleBrandNameChange}
              onBrandColorsChange={handleBrandColorsChange}
              onBrandLogoChange={handleBrandLogoChange}
              onBrandBackgroundColorChange={handleBrandBackgroundColorChange}
              onBrandAccentColorChange={handleBrandAccentColorChange}
            />

            {/* Content Dimensions Control */}
            <div className="mt-6 pt-6 border-t border-neutral-800">
              <label className="block text-sm font-medium text-neutral-300 mb-4 font-mono">
                Dimensões do Conteúdo
              </label>

              {/* Width Control - Document Formats */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-neutral-400 font-mono">Formato do Documento</label>
                  <span className="font-mono text-brand-cyan font-semibold text-xs">
                    {data.contentWidth || 800}px
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleContentWidthChange(595)}
                    className={`px-3 py-2 rounded-md border text-xs font-mono transition-all ${data.contentWidth === 595
                      ? 'bg-brand-cyan/20 border-[brand-cyan] text-brand-cyan'
                      : 'bg-neutral-950/70 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                  >
                    A4
                    <div className="text-[10px] text-neutral-500 mt-0.5">595px</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleContentWidthChange(842)}
                    className={`px-3 py-2 rounded-md border text-xs font-mono transition-all ${data.contentWidth === 842
                      ? 'bg-brand-cyan/20 border-[brand-cyan] text-brand-cyan'
                      : 'bg-neutral-950/70 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                  >
                    A3
                    <div className="text-[10px] text-neutral-500 mt-0.5">842px</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleContentWidthChange(612)}
                    className={`px-3 py-2 rounded-md border text-xs font-mono transition-all ${data.contentWidth === 612
                      ? 'bg-brand-cyan/20 border-[brand-cyan] text-brand-cyan'
                      : 'bg-neutral-950/70 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                  >
                    Letter
                    <div className="text-[10px] text-neutral-500 mt-0.5">612px</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleContentWidthChange(800)}
                    className={`px-3 py-2 rounded-md border text-xs font-mono transition-all ${(data.contentWidth === 800 || !data.contentWidth)
                      ? 'bg-brand-cyan/20 border-[brand-cyan] text-brand-cyan'
                      : 'bg-neutral-950/70 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                  >
                    Custom
                    <div className="text-[10px] text-neutral-500 mt-0.5">800px</div>
                  </button>
                </div>
                {/* Custom width input if not a standard format */}
                {data.contentWidth && ![595, 842, 612, 800].includes(data.contentWidth) && (
                  <div className="mt-2">
                    <input
                      type="number"
                      min="400"
                      max="1200"
                      step="10"
                      value={data.contentWidth}
                      onChange={(e) => handleContentWidthChange(Number(e.target.value))}
                      placeholder="Largura customizada"
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-xs text-neutral-200 font-mono focus:outline-none focus:border-[brand-cyan]"
                    />
                  </div>
                )}
              </div>

              {/* Height Control */}
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-neutral-400 font-mono">Altura</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={data.contentHeight || ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : Number(e.target.value);
                        handleContentHeightChange(value);
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '' || Number(e.target.value) <= 0) {
                          handleContentHeightChange(0);
                        }
                      }}
                      placeholder="Auto"
                      className="w-20 px-2 py-1 bg-neutral-950/70 border border-neutral-800 rounded-xl text-xs text-neutral-200 font-mono focus:outline-none focus:border-[brand-cyan]/70 transition-all duration-300"
                    />
                    <span className="text-xs text-neutral-500">px</span>
                    {data.contentHeight && (
                      <button
                        onClick={() => handleContentHeightChange(0)}
                        className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                        title="Remover altura fixa"
                      >
                        Auto
                      </button>
                    )}
                  </div>
                </div>
                {data.contentHeight ? (
                  <input
                    type="range"
                    min="500"
                    max="2000"
                    step="50"
                    value={data.contentHeight}
                    onChange={(e) => handleContentHeightChange(Number(e.target.value))}
                    className="w-full h-2 bg-neutral-800 rounded-md appearance-none cursor-pointer accent-[brand-cyan]"
                  />
                ) : (
                  <p className="text-xs text-neutral-500 italic">Altura automática (baseada no conteúdo)</p>
                )}
                {data.contentHeight && (
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>500px</span>
                    <span>{data.contentHeight}px</span>
                    <span>2000px</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-neutral-500 mt-4 pt-4 border-t border-neutral-800">
                As dimensões serão aplicadas no preview e no PDF exportado
              </p>
            </div>

            {/* Template Actions */}
            <div className="mt-6 pt-6 border-t border-neutral-800 space-y-3 mb-[40px]">
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-[brand-cyan]/30 rounded-md text-brand-cyan text-sm font-mono transition-all"
                >
                  <Save size={16} />
                  Salvar como Template
                </button>
                <button
                  onClick={() => setShowLoadModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-neutral-300 text-sm font-mono transition-all"
                  disabled={templates.length === 0}
                >
                  <FolderOpen size={16} />
                  Carregar Template
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Template Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-neutral-950/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-neutral-200 font-mono mb-4">
              Salvar como Template
            </h3>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Nome do template"
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-neutral-200 font-mono focus:outline-none focus:border-[brand-cyan] mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  saveTemplate();
                } else if (e.key === 'Escape') {
                  setShowSaveModal(false);
                  setTemplateName('');
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={saveTemplate}
                className="flex-1 px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/90 text-black font-semibold rounded-md text-sm font-mono transition-all"
              >
                Salvar
              </button>
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setTemplateName('');
                }}
                className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md text-sm font-mono transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Template Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-neutral-950/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <h3 className="text-lg font-semibold text-neutral-200 font-mono mb-4">
              Carregar Template
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {templates.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-8">
                  Nenhum template salvo ainda
                </p>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => loadTemplate(template)}
                    className="p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md cursor-pointer transition-all group relative"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-neutral-200 font-mono mb-1">
                          {template.name}
                        </h4>
                        <p className="text-xs text-neutral-400 font-mono">
                          {template.brandName}
                        </p>
                        <div className="flex gap-1 mt-2">
                          {template.brandColors.map((color, idx) => (
                            <div
                              key={idx}
                              className="w-4 h-4 rounded border border-neutral-700"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteTemplate(template.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition-opacity"
                        title="Remover template"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setShowLoadModal(false)}
              className="w-full px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md text-sm font-mono transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Overlay when panel is open (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-neutral-950/50 z-40 sm:hidden"
          onClick={togglePanel}
          aria-hidden="true"
        />
      )}
    </>
  );
};

