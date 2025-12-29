import React, { useState, useRef, useCallback, memo, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { LabeledHandle } from './shared/LabeledHandle';
import { Loader2, UploadCloud, FileText, Palette, X, ChevronDown, ChevronUp, Plus, Trash2, Edit2, Check } from 'lucide-react';
import type { BrandNodeData, BrandIdentity } from '../../types/reactFlow';
import { cn } from '../../lib/utils';
import { fileToBase64 } from '../../utils/fileUtils';
import { pdfToBase64, validatePdfFile } from '../../utils/pdfUtils';
import { toast } from 'sonner';
import { normalizeImageToBase64 } from '../../services/reactFlowService';
import { Image as ImageIcon } from 'lucide-react';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeLabel } from './shared/node-label';
import { NodeButton } from './shared/node-button';
import { useTranslation } from '../../hooks/useTranslation';
import { extractColors } from '../../utils/colorExtraction';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

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
      <div className="relative w-8 h-8 rounded border border-zinc-700 overflow-hidden shrink-0">
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
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-zinc-500 hover:text-red-400 shrink-0"
        onClick={onDelete}
      >
        <Trash2 size={14} />
      </Button>
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
          <div className="text-zinc-500 font-mono capitalize text-xs">{title}</div>
          <div className="flex items-center gap-1">
            {isEditing ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-green-400 hover:text-green-300"
                onClick={() => setEditingCategory(null)}
                title="Finish Editing"
              >
                <Check size={12} />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-zinc-500 hover:text-zinc-300"
                onClick={() => setEditingCategory(category)}
                title="Edit Colors"
              >
                <Edit2 size={12} />
              </Button>
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
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 mt-2"
              onClick={() => handleColorAdd(category)}
            >
              <Plus size={12} className="mr-1" /> Add Color
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {colors.map((color, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 px-2 py-1 bg-zinc-900/50 rounded border border-zinc-700/30 cursor-pointer hover:border-zinc-500 transition-colors group/color"
                title="Click to edit"
                onClick={() => setEditingCategory(category)}
              >
                <div
                  className="w-3 h-3 rounded border border-zinc-700/50"
                  style={{ backgroundColor: color }}
                />
                <span className="text-zinc-400 font-mono text-[10px] group-hover/color:text-zinc-300 transition-colors">{color}</span>
              </div>
            ))}
            {colors.length === 0 && (
              <span className="text-[10px] text-zinc-600 italic">No colors</span>
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
      className="p-5 min-w-[320px] max-w-[400px]"
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
      <NodeHeader icon={Palette} title={t('canvasNodes.brandNode.title')} />

      {/* Logo Upload Section */}
      <div className="mb-4">
        <NodeLabel>Logo {connectedLogo && <span className="text-[10px] text-zinc-500">(connected)</span>}</NodeLabel>
        {logoImageUrl ? (
          <div className="relative group/logo">
            <div className="relative w-full h-24 bg-zinc-900/50 rounded border border-zinc-700/30 overflow-hidden">
              <img
                src={logoImageUrl}
                alt="Logo"
                className="w-full h-full object-contain p-2"
              />
            </div>
            {!connectedLogo && (
              <button
                onClick={handleRemoveLogo}
                className="absolute top-1 right-1 p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded opacity-0 group-hover/logo:opacity-100 transition-opacity"
                title={t('canvasNodes.brandNode.removeLogo')}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ) : (
          <>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoFileChange}
              className="hidden"
            />
            <NodeButton onClick={handleLogoUploadClick}>
              <UploadCloud size={14} />
              Upload Logo
            </NodeButton>
          </>
        )}
      </div>

      {/* Identity Guide Upload Section (PDF or PNG) */}
      <div className="mb-4">
        <NodeLabel>Identity Guide (PDF or PNG) {connectedIdentity && <span className="text-[10px] text-zinc-500">(connected)</span>}</NodeLabel>
        {identityBase64 || nodeData.identityPdfUrl || nodeData.identityImageUrl ? (
          <div className="relative group/identity">
            {identityFileType === 'png' && identityImageUrl ? (
              <div className="relative w-full h-24 bg-zinc-900/50 rounded border border-zinc-700/30 overflow-hidden">
                <img
                  src={identityImageUrl}
                  alt="Identity Guide"
                  className="w-full h-full object-contain p-2"
                />
                {!connectedIdentity && (
                  <button
                    onClick={handleRemoveIdentity}
                    className="absolute top-1 right-1 p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded opacity-0 group-hover/identity:opacity-100 transition-opacity"
                    title={t('canvasNodes.brandNode.removeIdentityGuide')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ) : (
              <div className="px-3 py-2 bg-zinc-900/50 rounded border border-zinc-700/30 flex items-center gap-3">
                <FileText size={16} className="text-[#52ddeb]" />
                <span className="text-xs font-mono text-zinc-400 flex-1">{identityFileType?.toUpperCase()} {connectedIdentity ? 'connected' : 'uploaded'}</span>
                {!connectedIdentity && (
                  <button
                    onClick={handleRemoveIdentity}
                    className="p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded opacity-0 group-hover/identity:opacity-100 transition-opacity"
                    title={t('canvasNodes.brandNode.removeIdentityGuide')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/jpg"
              onChange={handleIdentityFileChange}
              className="hidden"
            />
            <NodeButton onClick={handlePdfUploadClick}>
              <FileText size={14} />
              Upload PDF or PNG
            </NodeButton>
          </>
        )}
      </div>

      {/* Analyze Button */}
      <NodeButton
        onClick={handleAnalyze}
        disabled={!canAnalyze}
        variant="primary"
        className="mb-4"
      >
        {isAnalyzing ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Palette size={14} />
            Analyze Brand Identity
          </>
        )}
      </NodeButton>

      {/* Brand Identity Display */}
      {brandIdentity && (
        <div className="border-t border-zinc-700/30 pt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between text-xs font-mono text-zinc-400 hover:text-zinc-300 mb-2"
          >
            <span>Brand Identity</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isExpanded && (
            <div className="space-y-3 text-xs">
              {/* Colors */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-zinc-500 font-mono">Colors</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[10px] px-2 text-zinc-500 hover:text-zinc-300"
                    onClick={manuallyExtractColors}
                    disabled={!logoBase64}
                  >
                    Extract from Logo
                  </Button>
                </div>

                {renderColorCategory('Primary', 'primary', brandIdentity.colors.primary)}
                {renderColorCategory('Secondary', 'secondary', brandIdentity.colors.secondary)}
                {renderColorCategory('Accent', 'accent', brandIdentity.colors.accent)}
              </div>

              {/* Typography */}
              {brandIdentity.typography.primary && (
                <div>
                  <div className="text-zinc-500 font-mono mb-1">Typography</div>
                  <div className="text-zinc-400">{brandIdentity.typography.primary}</div>
                  {brandIdentity.typography.secondary && (
                    <div className="text-zinc-500 text-[10px] mt-1">{brandIdentity.typography.secondary}</div>
                  )}
                </div>
              )}

              {/* Personality */}
              {(brandIdentity.personality.tone || brandIdentity.personality.feeling) && (
                <div>
                  <div className="text-zinc-500 font-mono mb-1">Personality</div>
                  <div className="text-zinc-400 space-y-1">
                    {brandIdentity.personality.tone && (
                      <div>Tone: {brandIdentity.personality.tone}</div>
                    )}
                    {brandIdentity.personality.feeling && (
                      <div>Feeling: {brandIdentity.personality.feeling}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Visual Elements */}
              {brandIdentity.visualElements.length > 0 && (
                <div>
                  <div className="text-zinc-500 font-mono mb-1">Visual Elements</div>
                  <div className="flex flex-wrap gap-1">
                    {brandIdentity.visualElements.slice(0, 5).map((element, idx) => (
                      <span key={idx} className="px-2 py-1 bg-zinc-900/50 rounded border border-zinc-700/30 text-zinc-400 text-[10px]">
                        {element}
                      </span>
                    ))}
                    {brandIdentity.visualElements.length > 5 && (
                      <span className="text-zinc-500 text-[10px]">+{brandIdentity.visualElements.length - 5} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </NodeContainer>
  );
});

BrandNode.displayName = 'BrandNode';
