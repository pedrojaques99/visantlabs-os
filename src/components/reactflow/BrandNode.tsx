import React, { useState, useRef, useCallback, memo, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { LabeledHandle } from './shared/LabeledHandle';
import { UploadCloud, FileText, Palette, X, ChevronDown, ChevronUp, Plus, Trash2, Edit2, Check, Maximize2 } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { BrandNodeData, BrandIdentity } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { fileToBase64 } from '@/utils/fileUtils';
import { pdfToBase64, validatePdfFile } from '@/utils/pdfUtils';
import { toast } from 'sonner';
import { normalizeImageToBase64 } from '@/services/reactFlowService';
import { Image as ImageIcon } from 'lucide-react';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeLabel } from './shared/node-label';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/useTranslation';
import { NodeButton } from './shared/node-button';
import { extractColors } from '@/utils/colorExtraction';

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
    // Reset to valid color on blur if invalid
    if (!hexValue.match(/^#[0-9A-Fa-f]{6}$/) && !hexValue.match(/^#[0-9A-Fa-f]{3}$/)) {
      setHexValue(color);
    }
  };

  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="relative w-8 h-8 rounded border border-neutral-700 overflow-hidden shrink-0">
        <div
          className="absolute inset-0"
          style={{ backgroundColor: color }}
        />
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
        className="h-8 font-mono text-xs uppercase"
        placeholder="#000000"
      />
      <NodeButton
        variant="ghost"
        size="xs"
        className="h-8 w-8 text-neutral-500 hover:text-red-400 shrink-0"
        onClick={onDelete}
      >
        <Trash2 size={14} />
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
    if (!file || !nodeData.onUploadLogo) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('canvasNodes.brandNode.pleaseSelectImageFile'), { duration: 3000 });
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('canvasNodes.brandNode.fileSizeExceedsLimit'), { duration: 5000 });
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      return;
    }

    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }

    try {
      const imageData = await fileToBase64(file);
      nodeData.onUploadLogo(id, imageData.base64);
      toast.success(t('canvasNodes.brandNode.logoUploadedSuccessfully'), { duration: 2000 });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to process logo image', { duration: 5000 });
      console.error('Failed to process logo:', error);
    }
  };

  const handleIdentityFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nodeData.onUpdateData) return;

    let fileType: 'pdf' | 'png' | null = null;
    let base64: string;
    let errorMessage = '';

    // Check if it's a PDF
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const validation = validatePdfFile(file);
      if (!validation.isValid) {
        errorMessage = validation.error || 'Invalid PDF file';
      } else {
        fileType = 'pdf';
        try {
          base64 = await pdfToBase64(file);
        } catch (error: any) {
          errorMessage = error?.message || 'Failed to process PDF';
        }
      }
    }
    // Check if it's an image (PNG, JPG, etc.)
    else if (file.type.startsWith('image/')) {
      fileType = 'png'; // Use 'png' as the type identifier for all images
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        errorMessage = 'File size exceeds 10MB limit';
      } else {
        try {
          const imageData = await fileToBase64(file);
          base64 = imageData.base64;
        } catch (error: any) {
          errorMessage = error?.message || 'Failed to process image';
        }
      }
    } else {
      errorMessage = 'Please select a PDF or image file (PNG, JPG, etc.)';
    }

    if (errorMessage || !fileType || !base64) {
      toast.error(errorMessage || 'Failed to process file', { duration: 5000 });
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
      return;
    }

    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }

    try {
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
      toast.success(`${fileType.toUpperCase()} uploaded successfully!`, { duration: 2000 });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to process file', { duration: 5000 });
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
        toast.success("Colors extracted from logo successfully");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to extract colors");
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
        throw new Error('Failed to process properties images');
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
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-neutral-500 font-mono capitalize text-xs">{title}</div>
          <div className="flex items-center gap-1">
            {isEditing ? (
              <NodeButton
                variant="ghost"
                size="xs"
                className="h-5 w-5 text-green-400 hover:text-green-300"
                onClick={() => setEditingCategory(null)}
                title="Finish Editing"
              >
                <Check size={12} />
              </NodeButton>
            ) : (
              <NodeButton
                variant="ghost"
                size="xs"
                className="h-5 w-5 text-neutral-500 hover:text-neutral-300"
                onClick={() => setEditingCategory(category)}
                title="Edit Colors"
              >
                <Edit2 size={12} />
              </NodeButton>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-1">
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
              className="w-full h-7 text-xs border-dashed border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-500 mt-2"
              onClick={() => handleColorAdd(category)}
            >
              <Plus size={12} className="mr-1" /> Add Color
            </NodeButton>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {colors.map((color, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 px-2 py-1 bg-neutral-900/50 rounded border border-neutral-700/30 cursor-pointer hover:border-neutral-500 transition-colors group/color"
                title="Click to edit"
                onClick={() => setEditingCategory(category)}
              >
                <div
                  className="w-3 h-3 rounded border border-neutral-700/50"
                  style={{ backgroundColor: color }}
                />
                <span className="text-neutral-400 font-mono text-[10px] group-hover/color:text-neutral-300 transition-colors">{color}</span>
              </div>
            ))}
            {colors.length === 0 && (
              <span className="text-[10px] text-neutral-600 italic">No colors</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="min-w-[320px] max-w-[400px]"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
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
      <div className="flex items-center justify-between p-4 border-b border-neutral-700/30 bg-gradient-to-r from-neutral-900/60 to-neutral-900/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-brand-cyan/10 border border-brand-cyan/20 shadow-sm">
            <Palette size={16} className="text-brand-cyan" />
          </div>
          <h3 className="text-xs font-semibold text-neutral-200 font-mono tracking-tight uppercase">
            {t('canvasNodes.brandNode.title') || 'Brand Engine'}
          </h3>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-[var(--node-gap)]">
        {/* Logo Upload Section */}
        <div className={cn(
          "p-3 rounded-lg border transition-all duration-300 backdrop-blur-sm",
          logoImageUrl
            ? "bg-brand-cyan/5 border-brand-cyan/20 shadow-[0_0_15px_rgba(var(--brand-cyan),0.05)]"
            : "bg-neutral-900/40 border-neutral-700/30"
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]",
                logoImageUrl ? "text-brand-cyan bg-brand-cyan" : "text-neutral-500 bg-neutral-600"
              )} />
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Logo DNA</span>
            </div>
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
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-md overflow-hidden bg-neutral-950/40 border border-neutral-700/50 p-1 flex items-center justify-center shadow-inner">
                <img
                  src={logoImageUrl}
                  alt="Logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-mono text-brand-cyan/70 uppercase">
                  {connectedLogo ? 'Connected' : 'Local Source'}
                </div>
                <div className="text-[11px] text-neutral-400 opacity-60">Property detected</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="hidden"
              />
              <NodeButton variant="primary" size="full" onClick={handleLogoUploadClick} className="shadow-sm">
                <UploadCloud size={14} className="mr-2" />
                Upload Logo
              </NodeButton>
            </div>
          )}
        </div>

        {/* Identity Guide Upload Section (PDF or PNG) */}
        <div className={cn(
          "p-3 rounded-lg border transition-all duration-300 backdrop-blur-sm",
          (identityBase64 || nodeData.identityPdfUrl || nodeData.identityImageUrl)
            ? "bg-brand-cyan/5 border-brand-cyan/20 shadow-[0_0_15px_rgba(var(--brand-cyan),0.05)]"
            : "bg-neutral-900/40 border-neutral-700/30"
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]",
                (identityBase64 || nodeData.identityPdfUrl || nodeData.identityImageUrl) ? "text-brand-cyan bg-brand-cyan" : "text-neutral-500 bg-neutral-600"
              )} />
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Brand Guidelines</span>
            </div>
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
              <div className="p-3 rounded-md bg-neutral-950/40 border border-neutral-700/50 shadow-inner">
                <FileText size={20} className="text-brand-cyan/70" />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-[10px] font-mono text-brand-cyan/70 uppercase">
                  {identityFileType?.toUpperCase() || 'FILE'} FOUND
                </div>
                <div className="text-[11px] text-neutral-400 opacity-60">
                  {connectedIdentity ? 'Reference document' : 'Local upload'}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg"
                onChange={handleIdentityFileChange}
                className="hidden"
              />
              <NodeButton variant="primary" size="full" onClick={handlePdfUploadClick} className="shadow-sm">
                <FileText size={14} className="mr-2" />
                Upload Guidelines
              </NodeButton>
            </div>
          )}
        </div>

        {/* Analyze Button */}
        <NodeButton
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          variant="primary"
          size="full"
          className="shadow-sm backdrop-blur-sm"
        >
          {isAnalyzing ? (
            <>
              <GlitchLoader size={14} className="mr-2" color="currentColor" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Palette size={14} className="mr-2" />
              <span>Analyze Brand Engine</span>
            </>
          )}
        </NodeButton>

        {/* Brand Identity Display */}
        {brandIdentity && (
          <div className="border-t border-neutral-700/30 pt-4">
            <NodeButton 
              variant="ghost" 
              size="full"             
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-between group/expand px-1"
            >
              <span className="text-[10px] font-mono font-bold text-neutral-500 group-hover:text-neutral-300 uppercase tracking-widest transition-colors">Extracted Identity</span>
              <div className="p-1 rounded-full bg-neutral-900/50 group-hover:bg-neutral-800 transition-colors">
                {isExpanded ? <ChevronUp size={12} className="text-neutral-400" /> : <ChevronDown size={12} className="text-neutral-400" />}
              </div>
            </NodeButton>

            {isExpanded && (
              <div className="mt-4 space-y-4 text-[11px] animate-in fade-in slide-in-from-top-1 duration-300">
                {/* Colors */}
                <div className="p-2.5 rounded-lg bg-neutral-900/40 border border-neutral-700/20 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-tighter font-bold">Palette Matrix</div>
                    <NodeButton
                      variant="ghost"
                      size="xs"
                      className="h-6 text-[9px] px-2 text-brand-cyan/70 hover:bg-brand-cyan/10 border border-brand-cyan/20"
                      onClick={manuallyExtractColors}
                      disabled={!logoBase64}
                    >
                      Refine from Logo
                    </NodeButton>
                  </div>

                  <div className="space-y-4">
                    {renderColorCategory('Primary', 'primary', brandIdentity.colors.primary)}
                    {renderColorCategory('Secondary', 'secondary', brandIdentity.colors.secondary)}
                    {renderColorCategory('Accent', 'accent', brandIdentity.colors.accent)}
                  </div>
                </div>

                {/* Typography */}
                {brandIdentity.typography.primary && (
                  <div className="p-2.5 rounded-lg bg-neutral-900/40 border border-neutral-700/20 backdrop-blur-sm">
                    <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-tighter mb-2 font-bold">Typography</div>
                    <div className="space-y-1">
                      <div className="text-neutral-300 font-medium">{brandIdentity.typography.primary}</div>
                      {brandIdentity.typography.secondary && (
                        <div className="text-neutral-500 text-[9px] italic">{brandIdentity.typography.secondary}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Personality */}
                {(brandIdentity.personality.tone || brandIdentity.personality.feeling) && (
                  <div className="p-2.5 rounded-lg bg-neutral-900/40 border border-neutral-700/20 backdrop-blur-sm">
                    <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-tighter mb-2 font-bold">Persona</div>
                    <div className="grid grid-cols-1 gap-2 text-neutral-400 leading-relaxed">
                      {brandIdentity.personality.tone && (
                        <div><span className="text-neutral-600 uppercase text-[8px] font-mono mr-2">Tone:</span>{brandIdentity.personality.tone}</div>
                      )}
                      {brandIdentity.personality.feeling && (
                        <div><span className="text-neutral-600 uppercase text-[8px] font-mono mr-2">Feeling:</span>{brandIdentity.personality.feeling}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Visual Elements */}
                {brandIdentity.visualElements.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-neutral-900/40 border border-neutral-700/20 backdrop-blur-sm">
                    <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-tighter mb-2 font-bold">Visual Language</div>
                    <div className="flex flex-wrap gap-1.5">
                      {brandIdentity.visualElements.slice(0, 8).map((element, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-neutral-950/40 rounded text-[9px] text-neutral-400 border border-neutral-700/30 uppercase tracking-wider">
                          {element}
                        </span>
                      ))}
                      {brandIdentity.visualElements.length > 8 && (
                        <span className="text-neutral-500 text-[8px] font-mono">+{brandIdentity.visualElements.length - 8}</span>
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
