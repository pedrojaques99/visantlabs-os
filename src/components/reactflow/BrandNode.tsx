import React, { useState, useRef, useCallback, memo, useEffect } from 'react';
import { Position, type NodeProps, NodeResizer } from '@xyflow/react';
import { LabeledHandle } from './shared/LabeledHandle';
import { UploadCloud, FileText, Palette, X, ChevronDown, ChevronUp, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { BrandNodeData, BrandIdentity } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { fileToBase64, validateFile } from '@/utils/fileUtils';
import { pdfToBase64, validatePdfFile } from '@/utils/pdfUtils';
import { toast } from 'sonner';
import { normalizeImageToBase64 } from '@/services/reactFlowService';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeLabel } from './shared/node-label';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/useTranslation';
import { NodeButton } from './shared/node-button';
import { extractColors } from '@/utils/colorExtraction';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';

// Component for editing a single color row
const ColorEditRow = ({
  color,
  onChange,
  onDelete
}: {
  color: string;
  onChange: (newColor: string) => void;
  onDelete: () => void;
}) => {
  const [hexValue, setHexValue] = useState(color);

  useEffect(() => {
    setHexValue(color);
  }, [color]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexValue(val);
    if (val.match(/^#[0-9A-Fa-f]{6}$/) || val.match(/^#[0-9A-Fa-f]{3}$/)) {
      onChange(val);
    }
  };

  const handleBlur = () => {
    if (!hexValue.match(/^#[0-9A-Fa-f]{6}$/) && !hexValue.match(/^#[0-9A-Fa-f]{3}$/)) {
      setHexValue(color);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-6 h-6 rounded border border-neutral-700/50 overflow-hidden shrink-0">
        <div className="absolute inset-0" style={{ backgroundColor: color }} />
        <input
          type="color"
          value={color.length === 7 ? color : '#000000'}
          onChange={(e) => {
            onChange(e.target.value);
            setHexValue(e.target.value);
          }}
          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
        />
      </div>
      <Input
        value={hexValue}
        onChange={handleHexChange}
        onBlur={handleBlur}
        className="h-6 font-mono text-[10px] uppercase flex-1"
        placeholder="#000000"
      />
      <NodeButton
        variant="ghost"
        size="xs"
        className="h-6 w-6 text-neutral-500 hover:text-red-400 p-0 shrink-0"
        onClick={onDelete}
      >
        <Trash2 size={12} />
      </NodeButton>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BrandNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const nodeData = data as BrandNodeData;
  const logoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();

  // Prioritize connected data over direct uploads
  const connectedLogo = nodeData.connectedLogo;
  const connectedIdentity = nodeData.connectedIdentity;
  const connectedIdentityType = nodeData.connectedIdentityType;

  const logoBase64 = connectedLogo || nodeData.logoBase64;
  const identityBase64 = connectedIdentity || nodeData.identityPdfBase64 || nodeData.identityImageBase64;
  const identityFileType = connectedIdentityType || nodeData.identityFileType || (nodeData.identityPdfBase64 ? 'pdf' : nodeData.identityImageBase64 ? 'png' : undefined);
  const brandIdentity = nodeData.brandIdentity;

  // Start expanded if brandIdentity already exists
  const [isExpanded, setIsExpanded] = useState(!!brandIdentity);
  const isAnalyzing = nodeData.isAnalyzing || false;

  // Independent editing states for each color category
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  // Auto-expand when brandIdentity is added
  useEffect(() => {
    if (brandIdentity && !isExpanded) {
      setIsExpanded(true);
    }
  }, [brandIdentity, isExpanded]);

  // Debounced fit-to-content: update node size when container content changes
  const debouncedFitToContent = useDebouncedCallback(() => {
    const el = containerRef.current;
    if (!el || !nodeData.onResize) return;
    const w = Math.max(el.scrollWidth, el.offsetWidth);
    const h = Math.max(el.scrollHeight, el.offsetHeight);
    if (w > 0 && h > 0) {
      fitToContent(id, w, 'auto', nodeData.onResize as any, undefined, h);
    }
  }, 150);

  // ResizeObserver: auto-fit node when expanded state changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => debouncedFitToContent());
    ro.observe(el);
    debouncedFitToContent();
    return () => ro.disconnect();
  }, [id, debouncedFitToContent]);

  // Handle resize from NodeResizer
  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, 'auto', nodeData.onResize);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    fitToContent(id, 'auto', 'auto', nodeData.onResize);
  }, [id, nodeData.onResize, fitToContent]);

  // Format logo URL - handle both base64 strings and data URLs
  const logoImageUrl = logoBase64
    ? (logoBase64.startsWith('http') || logoBase64.startsWith('data:')
      ? logoBase64
      : `data:image/png;base64,${logoBase64}`)
    : nodeData.logoImage;

  // Format identity image URL - handle both base64 strings and data URLs
  const identityImageUrl = identityFileType === 'png' && identityBase64
    ? (identityBase64.startsWith('http') || identityBase64.startsWith('data:')
      ? identityBase64
      : `data:image/png;base64,${identityBase64}`)
    : undefined;

  const handleLogoUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    logoInputRef.current?.click();
  };

  const handlePdfUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    pdfInputRef.current?.click();
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (logoInputRef.current) logoInputRef.current.value = '';
    if (!file || !nodeData.onUploadLogo) return;

    const error = validateFile(file, 'image');
    if (error) {
      toast.error(error, { duration: 3000 });
      return;
    }

    try {
      const imageData = await fileToBase64(file);
      nodeData.onUploadLogo(id, imageData.base64);
      toast.success(t('canvasNodes.brandNode.logoUploadedSuccessfully'), { duration: 2000 });
    } catch (err: any) {
      toast.error(err?.message || t('canvasNodes.logoNode.failedToProcessLogo'), { duration: 5000 });
    }
  };

  const handleIdentityFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (pdfInputRef.current) pdfInputRef.current.value = '';
    if (!file || !nodeData.onUpdateData) return;

    const error = validateFile(file, ['image', 'pdf']);
    if (error) {
      toast.error(error, { duration: 3000 });
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    try {
      let base64: string;
      let fileType: 'pdf' | 'png';

      if (isPdf) {
        const validation = validatePdfFile(file);
        if (!validation.isValid) {
          toast.error(validation.error || 'Invalid PDF', { duration: 3000 });
          return;
        }
        base64 = await pdfToBase64(file);
        fileType = 'pdf';
      } else {
        const imageData = await fileToBase64(file);
        base64 = imageData.base64;
        fileType = 'png';
      }
      // Update node with the uploaded file
      if (nodeData.onUpdateData) {
        if (fileType === 'pdf') {
          nodeData.onUpdateData(id, {
            identityPdfBase64: base64,
            identityImageBase64: undefined,
            identityFileType: 'pdf'
          });
        } else {
          nodeData.onUpdateData(id, {
            identityImageBase64: base64,
            identityPdfBase64: undefined,
            identityFileType: 'png'
          });
        }
      }
      toast.success(t('common.success'), { duration: 2000 });
    } catch (error: any) {
      toast.error(error?.message || t('canvas.failedToProcessImage'), { duration: 5000 });
      console.error('Failed to process identity file:', error);
    }
  };

  const updateColors = useCallback((newColors: BrandIdentity['colors']) => {
    if (!nodeData.onUpdateData || !brandIdentity) return;

    nodeData.onUpdateData(id, {
      brandIdentity: {
        ...brandIdentity,
        colors: newColors
      }
    });
  }, [nodeData, id, brandIdentity]);

  const handleColorChange = (category: keyof BrandIdentity['colors'], index: number, newColor: string) => {
    if (!brandIdentity) return;

    const currentCategory = [...brandIdentity.colors[category]];
    currentCategory[index] = newColor;

    updateColors({
      ...brandIdentity.colors,
      [category]: currentCategory
    });
  };

  const handleColorDelete = (category: keyof BrandIdentity['colors'], index: number) => {
    if (!brandIdentity) return;

    const currentCategory = [...brandIdentity.colors[category]];
    currentCategory.splice(index, 1);

    updateColors({
      ...brandIdentity.colors,
      [category]: currentCategory
    });
  };

  const handleColorAdd = (category: keyof BrandIdentity['colors']) => {
    if (!brandIdentity) return;

    const currentCategory = [...brandIdentity.colors[category]];
    currentCategory.push('#000000');

    updateColors({
      ...brandIdentity.colors,
      [category]: currentCategory
    });
  };

  const manuallyExtractColors = async () => {
    if (!logoBase64) return;

    try {
      const normalizedLogo = await normalizeImageToBase64(logoBase64);
      const extracted = await extractColors(normalizedLogo, 'image/png', 10, false);

      if (extracted && extracted.colors && extracted.colors.length > 0 && brandIdentity) {
        const colors = extracted.colors;
        const primary = colors.slice(0, 3);
        const secondary = colors.slice(3, 7);
        const accent = colors.slice(7);

        updateColors({
          primary,
          secondary,
          accent
        });
        toast.success(t('canvasNodes.brandNode.colorsExtractedSuccessfully'));
      }
    } catch (e) {
      console.error(e);
      toast.error(t('canvasNodes.brandNode.failedToExtractColors'));
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!nodeData.onAnalyze || !logoBase64 || !identityBase64 || !identityFileType) {
      if (!logoBase64) {
        toast.error(t('canvasNodes.brandNode.pleaseUploadLogoFirst'), { duration: 3000 });
      }
      if (!identityBase64) {
        toast.error(t('canvasNodes.brandNode.pleaseUploadPdfOrPngFirst'), { duration: 3000 });
      }
      return;
    }

    try {
      const normalizedLogo = await normalizeImageToBase64(logoBase64);
      const normalizedIdentity = await normalizeImageToBase64(identityBase64);

      if (!normalizedLogo || !normalizedIdentity) {
        throw new Error(t('canvas.failedToProcessImage'));
      }

      await nodeData.onAnalyze(id, normalizedLogo, normalizedIdentity, identityFileType);

      // We don't automatically override colors here to avoid race conditions with standard analysis,
      // but we provide the "Extract from Logo" button for users to upgrade/fix the color palette manually.

    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error(t('canvasNodes.brandNode.analysisFailed'), { duration: 3000 });
    }
  }, [nodeData, id, logoBase64, identityBase64, identityFileType, t]);

  const handleRemoveLogo = () => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, { logoBase64: undefined, logoImage: undefined });
    }
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleRemoveIdentity = () => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, {
        identityPdfBase64: undefined,
        identityPdfUrl: undefined,
        identityImageBase64: undefined,
        identityImageUrl: undefined,
        identityFileType: undefined
      });
    }
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
  };

  const canAnalyze = !!(logoBase64 && identityBase64 && identityFileType && !isAnalyzing);

  const renderColorCategory = (title: string, category: keyof BrandIdentity['colors'], colors: string[]) => {
    const isEditing = editingCategory === category;

    return (
      <div className="mb-3 last:mb-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-neutral-500 font-mono text-[10px]">{title}</span>
          {isEditing ? (
            <NodeButton
              variant="ghost"
              size="xs"
              className="h-5 w-5 text-brand-cyan p-0"
              onClick={() => setEditingCategory(null)}
              title={t('common.done') || "Done"}
            >
              <Check size={10} />
            </NodeButton>
          ) : (
            <NodeButton
              variant="ghost"
              size="xs"
              className="h-5 w-5 text-neutral-500 hover:text-neutral-300 p-0"
              onClick={() => setEditingCategory(category)}
              title={t('common.edit') || "Edit"}
            >
              <Edit2 size={10} />
            </NodeButton>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-1.5">
            {colors.map((color, idx) => (
              <ColorEditRow
                key={`${category}-${idx}`}
                color={color}
                onChange={(newColor) => handleColorChange(category, idx, newColor)}
                onDelete={() => handleColorDelete(category, idx)}
              />
            ))}
            <NodeButton
              variant="ghost"
              size="xs"
              className="w-full h-6 text-[10px] text-neutral-500 hover:text-neutral-300"
              onClick={() => handleColorAdd(category)}
            >
              <Plus size={10} className="mr-1" /> {t('common.addColor') || "Add"}
            </NodeButton>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {colors.map((color, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-neutral-950/50 rounded border border-neutral-700/30 cursor-pointer hover:border-neutral-500 transition-colors"
                title={t('canvas.clickToEdit') || "Click to edit"}
                onClick={() => setEditingCategory(category)}
              >
                <div
                  className="w-2.5 h-2.5 rounded-sm border border-neutral-700/50"
                  style={{ backgroundColor: color }}
                />
                <span className="text-neutral-400 font-mono text-[10px]">{color}</span>
              </div>
            ))}
            {colors.length === 0 && (
              <span className="text-[10px] text-neutral-600">{t('common.noResults') || "None"}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <NodeContainer
      containerRef={containerRef}
      selected={selected}
      dragging={dragging}
      onFitToContent={handleFitToContent}
      className="min-w-[320px]"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={320}
          minHeight={300}
          maxWidth={2000}
          maxHeight={4000}
          onResize={(_, { width, height }) => {
            handleResize(width, height);
          }}
        />
      )}
      {/* Input Handles */}
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="logo-input"
        label={t('canvasNodes.brandNode.logo') || 'Logo'}
        style={{ top: '90px' }}
      />
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="identity-input"
        label={t('canvasNodes.brandNode.identity') || 'Identity'}
        style={{ top: '180px' }}
      />

      {/* Output Handles */}
      <LabeledHandle
        type="source"
        position={Position.Right}
        id="logo-output"
        // label removed to reduce clutter
        style={{ top: '90px' }}
      />
      <LabeledHandle
        type="source"
        position={Position.Right}
        id="identity-output"
        // label removed to reduce clutter
        style={{ top: '180px' }}
      />
      <LabeledHandle
        type="source"
        position={Position.Right}
        label={t('canvasNodes.brandNode.output') || 'Brand Context'}
        style={{ top: '270px' }} // Keep label for main context output? Or remove? User said "hide image output handles". 
      // The specific image handles are the ones creating clutter. 
      />

      {/* Header */}
      <NodeHeader
        icon={Palette}
        title={t('canvasNodes.brandNode.title') || "Brand Guideline"}
        selected={selected}
      />

      <div className="flex flex-col gap-[var(--node-gap)]">
        {/* Logo Upload Section */}
        <div className="p-3 rounded-md bg-neutral-900/40 border border-neutral-700/20">
          <div className="flex items-center justify-between mb-2">
            <NodeLabel className="text-[10px]">
              {t('canvasNodes.brandNode.logoDna') || "Logo DNA"}
            </NodeLabel>
            {logoImageUrl && !connectedLogo && (
              <NodeButton
                variant="ghost"
                size="xs"
                onClick={handleRemoveLogo}
                className="h-6 w-6 text-neutral-500 hover:text-red-400 p-0"
              >
                <X size={12} />
              </NodeButton>
            )}
          </div>

          {logoImageUrl ? (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-md overflow-hidden bg-neutral-950/50 border border-neutral-700/30 p-1 flex items-center justify-center">
                <img
                  src={logoImageUrl}
                  alt="Logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-mono text-brand-cyan/70">
                  {connectedLogo ? t('common.connected') : t('common.localSource') || 'Local Source'}
                </div>
                <div className="text-[10px] text-neutral-500">{t('common.propertyDetected') || "Property detected"}</div>
              </div>
            </div>
          ) : (
            <>
              <Input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="hidden"
              />
              <NodeButton variant="primary" size="full" onClick={handleLogoUploadClick}>
                <UploadCloud size={14} className="mr-2" />
                {t('canvasNodes.logoNode.uploadLogo')}
              </NodeButton>
            </>
          )}
        </div>

        {/* Identity Guide Upload Section (PDF or PNG) */}
        <div className="p-3 rounded-md bg-neutral-900/40 border border-neutral-700/20">
          <div className="flex items-center justify-between mb-2">
            <NodeLabel className="text-[10px]">
              {t('canvasNodes.brandNode.identity') || "Brand Guidelines"}
            </NodeLabel>
            {(identityBase64 || nodeData.identityPdfUrl || nodeData.identityImageUrl) && !connectedIdentity && (
              <NodeButton
                variant="ghost"
                size="xs"
                onClick={handleRemoveIdentity}
                className="h-6 w-6 text-neutral-500 hover:text-red-400 p-0"
              >
                <X size={12} />
              </NodeButton>
            )}
          </div>

          {(identityBase64 || nodeData.identityPdfUrl || nodeData.identityImageUrl) ? (
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-md bg-neutral-950/50 border border-neutral-700/30">
                <FileText size={18} className="text-brand-cyan/70" />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-[10px] font-mono text-brand-cyan/70">
                  {t('common.fileFound') || "File found"}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {connectedIdentity ? t('common.referenceDocument') : t('common.localUpload') || 'Local upload'}
                </div>
              </div>
            </div>
          ) : (
            <>
              <Input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg"
                onChange={handleIdentityFileChange}
                className="hidden"
              />
              <NodeButton variant="primary" size="full" onClick={handlePdfUploadClick}>
                <FileText size={14} className="mr-2" />
                {t('canvasNodes.brandCore.uploadLogo') || "Upload Guidelines"}
              </NodeButton>
            </>
          )}
        </div>

        {/* Analyze Button */}
        <NodeButton
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          variant="primary"
          size="full"
        >
          {isAnalyzing ? (
            <>
              <GlitchLoader size={14} className="mr-1" color="brand-cyan" />
              <span>{t('canvasNodes.directorNode.analyzing') || "Analyzing..."}</span>
            </>
          ) : (
            <>
              <Palette size={14} />
              <span>{t('canvasNodes.brandNode.analyze') || "Analyze Brand Engine"}</span>
            </>
          )}
        </NodeButton>

        {/* Brand Identity Display */}
        {brandIdentity && (
          <div className="border-t border-neutral-700/20 pt-3">
            <NodeButton
              variant="ghost"
              size="full"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-between"
            >
              <span className="text-[10px] font-mono text-neutral-500 uppercase">{t('canvasNodes.brandNode.extractedIdentity') || "Extracted Identity"}</span>
              {isExpanded ? <ChevronUp size={14} className="text-neutral-500" /> : <ChevronDown size={14} className="text-neutral-500" />}
            </NodeButton>

            {isExpanded && (
              <div className="mt-3 space-y-3 text-[11px]">
                {/* Colors */}
                <div className="p-2.5 rounded-md bg-neutral-900/40 border border-neutral-700/20">
                  <div className="flex items-center justify-between mb-2">
                    <NodeLabel className="text-[10px]">{t('canvasNodes.brandNode.paletteMatrix') || "Palette"}</NodeLabel>
                    <NodeButton
                      variant="ghost"
                      size="xs"
                      className="h-5 text-[10px] px-1.5 text-brand-cyan/70"
                      onClick={manuallyExtractColors}
                      disabled={!logoBase64}
                    >
                      {t('canvasNodes.brandNode.refineFromLogo') || "Refine"}
                    </NodeButton>
                  </div>

                  <div className="space-y-3">
                    {renderColorCategory('Primary', 'primary', brandIdentity.colors.primary)}
                    {renderColorCategory('Secondary', 'secondary', brandIdentity.colors.secondary)}
                    {renderColorCategory('Accent', 'accent', brandIdentity.colors.accent)}
                  </div>
                </div>

                {/* Typography */}
                {brandIdentity.typography.primary && (
                  <div className="p-2.5 rounded-md bg-neutral-900/40 border border-neutral-700/20">
                    <NodeLabel className="text-[10px] mb-1.5">{t('canvasNodes.brandNode.typography') || "Typography"}</NodeLabel>
                    <div className="space-y-1">
                      <div className="text-neutral-300 text-[11px]">{brandIdentity.typography.primary}</div>
                      {brandIdentity.typography.secondary && (
                        <div className="text-neutral-500 text-[10px]">{brandIdentity.typography.secondary}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Personality */}
                {(brandIdentity.personality.tone || brandIdentity.personality.feeling) && (
                  <div className="p-2.5 rounded-md bg-neutral-900/40 border border-neutral-700/20">
                    <NodeLabel className="text-[10px] mb-1.5">{t('canvasNodes.brandNode.persona') || "Persona"}</NodeLabel>
                    <div className="space-y-1.5 text-[11px] text-neutral-400">
                      {brandIdentity.personality.tone && (
                        <div><span className="text-neutral-600 text-[10px] font-mono mr-1.5">{t('canvasNodes.brandNode.tone') || "Tone:"}</span>{brandIdentity.personality.tone}</div>
                      )}
                      {brandIdentity.personality.feeling && (
                        <div><span className="text-neutral-600 text-[10px] font-mono mr-1.5">{t('canvasNodes.brandNode.feeling') || "Feeling:"}</span>{brandIdentity.personality.feeling}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Visual Elements */}
                {brandIdentity.visualElements.length > 0 && (
                  <div className="p-2.5 rounded-md bg-neutral-900/40 border border-neutral-700/20">
                    <NodeLabel className="text-[10px] mb-1.5">{t('canvasNodes.brandNode.visualLanguage') || "Visual Elements"}</NodeLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {brandIdentity.visualElements.slice(0, 8).map((element, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-neutral-950/50 rounded text-[10px] text-neutral-400 border border-neutral-700/30">
                          {element}
                        </span>
                      ))}
                      {brandIdentity.visualElements.length > 8 && (
                        <span className="text-neutral-500 text-[10px]">+{brandIdentity.visualElements.length - 8}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </NodeContainer>
  );
});

BrandNode.displayName = 'BrandNode';
