import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { LabeledHandle } from './shared/LabeledHandle';
import { Dna, ChevronDown, ChevronUp, Copy, Check, UploadCloud, FileText, X } from 'lucide-react';
import { GlitchLoader } from '../ui/GlitchLoader';
import type { BrandCoreData } from '../../types/reactFlow';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeButton } from './shared/node-button';
import { NodeLabel } from './shared/node-label';
import { generateVisualPrompt, consolidateStrategies, consolidateStrategiesToText } from '../../services/brandPromptService';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { ImageThumbnail } from '../ui/ImageThumbnail';
import { fileToBase64 } from '../../utils/fileUtils';
import { pdfToBase64, validatePdfFile, validatePdfBase64Size } from '../../utils/pdfUtils';
import { normalizeImageToBase64 } from '../../services/reactFlowService';
import { useTranslation } from '../../hooks/useTranslation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BrandCore = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const nodeData = data as BrandCoreData;

  const logoInputRef = useRef<HTMLInputElement>(null);
  const identityInputRef = useRef<HTMLInputElement>(null);

  const connectedLogo = nodeData.connectedLogo;
  const connectedPdf = nodeData.connectedPdf;
  const connectedImage = nodeData.connectedImage;
  const connectedStrategies = nodeData.connectedStrategies || [];
  const brandIdentity = nodeData.brandIdentity;

  const [isExpandedVisual, setIsExpandedVisual] = useState(false);
  const [isExpandedStrategic, setIsExpandedStrategic] = useState(false);
  const [isExpandedBrandIdentity, setIsExpandedBrandIdentity] = useState(!!brandIdentity);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const visualPrompts = nodeData.visualPrompts;
  const strategicPrompts = nodeData.strategicPrompts;
  const isAnalyzing = nodeData.isAnalyzing || false;
  const isGeneratingPrompts = nodeData.isGeneratingPrompts || false;

  // Support for direct upload (when not connected via handles)
  const uploadedLogo = nodeData.uploadedLogo;
  const uploadedIdentity = nodeData.uploadedIdentity;
  const uploadedIdentityUrl = nodeData.uploadedIdentityUrl; // URL do R2 para PDF
  const uploadedIdentityType = nodeData.uploadedIdentityType;

  // Use connected values first, fallback to uploaded values
  const logoBase64 = connectedLogo || uploadedLogo;
  // Para identity: priorizar connected, depois uploadedIdentityUrl (R2), depois uploadedIdentity (base64)
  const identityBase64 = connectedPdf || connectedImage || (uploadedIdentityUrl && uploadedIdentityType === 'pdf' ? uploadedIdentityUrl : uploadedIdentity);
  const identityType: 'pdf' | 'png' | undefined = connectedPdf ? 'pdf' : (connectedImage ? 'png' : uploadedIdentityType);

  // Auto-expand when brandIdentity is added
  useEffect(() => {
    if (brandIdentity && !isExpandedBrandIdentity) {
      setIsExpandedBrandIdentity(true);
    }
  }, [brandIdentity, isExpandedBrandIdentity]);

  // Auto-generate visual prompts when brandIdentity is available
  useEffect(() => {
    if (brandIdentity && !visualPrompts && !isGeneratingPrompts && nodeData.onGenerateVisualPrompts) {
      nodeData.onGenerateVisualPrompts(id);
    }
  }, [brandIdentity, visualPrompts, isGeneratingPrompts, id, nodeData]);

  // Auto-consolidate strategies when strategies are connected
  useEffect(() => {
    if (connectedStrategies.length > 0 && !strategicPrompts?.consolidated && nodeData.onGenerateStrategicPrompts) {
      nodeData.onGenerateStrategicPrompts(id);
    }
  }, [connectedStrategies, strategicPrompts, id, nodeData]);

  const handleCopyPrompt = useCallback((prompt: string, type: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(type);
    toast.success(t('canvasNodes.brandCore.promptCopied'), { duration: 2000 });
    setTimeout(() => setCopiedPrompt(null), 2000);
  }, []);

  const handleLogoUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    logoInputRef.current?.click();
  };

  const handleIdentityUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    identityInputRef.current?.click();
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!nodeData.onUpdateData) {
      console.error('[BrandCore] onUpdateData handler not available', { nodeId: id, hasHandler: !!nodeData.onUpdateData });
      toast.error(t('canvasNodes.brandCore.uploadHandlerNotReady'), { duration: 3000 });
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error(t('canvasNodes.brandCore.pleaseSelectImageFile'), { duration: 3000 });
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('canvasNodes.brandCore.fileSizeExceedsLimit'), { duration: 5000 });
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      return;
    }

    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }

    try {
      console.log('[BrandCore] Processing logo upload', { nodeId: id, fileName: file.name, fileSize: file.size });
      const imageData = await fileToBase64(file);
      nodeData.onUpdateData(id, { uploadedLogo: imageData.base64 });
      console.log('[BrandCore] Logo uploaded successfully', { nodeId: id });
      toast.success(t('canvasNodes.brandCore.logoUploadedSuccessfully'), { duration: 2000 });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to process logo image', { duration: 5000 });
      console.error('[BrandCore] Failed to process logo:', error);
    }
  };

  const handleIdentityFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!nodeData.onUpdateData) {
      console.error('[BrandCore] onUpdateData handler not available', { nodeId: id, hasHandler: !!nodeData.onUpdateData });
      toast.error(t('canvasNodes.brandCore.uploadHandlerNotReady'), { duration: 3000 });
      if (identityInputRef.current) {
        identityInputRef.current.value = '';
      }
      return;
    }

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
      if (identityInputRef.current) {
        identityInputRef.current.value = '';
      }
      return;
    }

    if (identityInputRef.current) {
      identityInputRef.current.value = '';
    }

    try {
      console.log('[BrandCore] Processing identity file upload', {
        nodeId: id,
        fileName: file.name,
        fileType,
        fileSize: file.size,
        hasOnUploadPdfToR2: !!nodeData.onUploadPdfToR2,
        hasOnUpdateData: !!nodeData.onUpdateData
      });

      // Para PDF: fazer upload direto para R2 (não armazenar base64)
      if (fileType === 'pdf' && nodeData.onUploadPdfToR2) {
        // Validate base64 size before upload to prevent 413 errors
        const sizeValidation = validatePdfBase64Size(base64);
        if (!sizeValidation.isValid) {
          toast.error(sizeValidation.error || 'PDF is too large for upload', { duration: 5000 });
          if (identityInputRef.current) {
            identityInputRef.current.value = '';
          }
          return;
        }

        toast.loading('Uploading PDF to cloud storage...', { id: 'pdf-upload' });
        const pdfUrl = await nodeData.onUploadPdfToR2(id, base64);
        console.log('[BrandCore] PDF uploaded successfully to R2', { nodeId: id, pdfUrl });
        toast.success(t('canvasNodes.brandCore.pdfUploadedSuccessfully'), { id: 'pdf-upload', duration: 2000 });
      } else {
        // Para imagens PNG: armazenar base64 (menor que PDF)
        if (fileType === 'pdf' && !nodeData.onUploadPdfToR2) {
          console.warn('[BrandCore] PDF upload requested but onUploadPdfToR2 handler not available, falling back to base64', { nodeId: id });
        }
        nodeData.onUpdateData(id, {
          uploadedIdentity: base64,
          uploadedIdentityType: fileType
        });
        console.log('[BrandCore] Identity file uploaded successfully', { nodeId: id, fileType });
        toast.success(`${fileType.toUpperCase()} uploaded successfully!`, { duration: 2000 });
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to process file', { duration: 5000 });
      console.error('[BrandCore] Failed to process identity file:', error);
    }
  };

  const handleRemoveLogo = () => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, { uploadedLogo: undefined });
    }
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleRemoveIdentity = () => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, {
        uploadedIdentity: undefined,
        uploadedIdentityUrl: undefined,
        uploadedIdentityType: undefined
      });
    }
    if (identityInputRef.current) {
      identityInputRef.current.value = '';
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!nodeData.onAnalyze || !logoBase64 || !identityBase64 || !identityType) {
      if (!logoBase64) {
        toast.error(t('canvasNodes.brandCore.pleaseUploadLogoFirst'), { duration: 3000 });
      }
      if (!identityBase64) {
        toast.error(t('canvasNodes.brandCore.pleaseUploadPdfOrPngFirst'), { duration: 3000 });
      }
      return;
    }

    if (identityType !== 'pdf' && identityType !== 'png') {
      toast.error(t('canvasNodes.brandCore.invalidIdentityType'), { duration: 3000 });
      return;
    }

    try {
      // Normalize images to base64 before sending to analysis
      const normalizedLogo = await normalizeImageToBase64(logoBase64);

      // For identity, only normalize if it's an image (PNG)
      // PDF handling might be different (usually direct URL or base64 depending on backend need)
      // Assuming onAnalyze expects base64 for images:
      let finalIdentity = identityBase64;
      if (identityType === 'png') {
        finalIdentity = await normalizeImageToBase64(identityBase64);
      }

      if (!normalizedLogo || !finalIdentity) {
        throw new Error('Failed to process property images');
      }

      await nodeData.onAnalyze(id, normalizedLogo, finalIdentity, identityType);
    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error('Failed to prepare images for analysis', { duration: 3000 });
    }
  }, [nodeData, id, logoBase64, identityBase64, identityType]);

  const hasLogo = !!logoBase64;
  const hasIdentity = !!identityBase64 || !!uploadedIdentityUrl;
  const hasStrategies = connectedStrategies.length > 0;
  const canAnalyze = hasLogo && hasIdentity && !brandIdentity && !isAnalyzing;
  const hasPrompts = !!(visualPrompts || strategicPrompts?.consolidated);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="p-5 min-w-[360px] max-w-[450px]"
    >
      {/* Input Handles */}
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="image-input"
        label={t('canvasNodes.brandCore.logo') || 'Logo'}
        className="w-2 h-2 bg-brand-cyan border-2 border-black"
        style={{ top: '90px' }}
      />
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="pdf-input"
        label={t('canvasNodes.brandCore.identityGuide') || 'Identity'}
        className="w-2 h-2 bg-brand-cyan border-2 border-black"
        style={{ top: '180px' }}
      />
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="strategy-input"
        label={t('canvasNodes.brandCore.strategy') || 'Strategy'}
        className="w-2 h-2 bg-brand-cyan border-2 border-black"
        style={{ top: '270px' }}
      />

      {/* Smart Output Handle - detects node type and provides appropriate data */}
      <LabeledHandle
        type="source"
        position={Position.Right}
        id="prompt-output"
        label={t('canvasNodes.brandCore.output') || 'Output'}
        className="w-2 h-2 bg-brand-cyan border-2 border-black"
        style={{ top: '50px' }}
      />

      {/* Header */}
      <NodeHeader icon={Dna} title={t('canvasNodes.brandCore.title')} />

      {/* Inputs Section */}
      <div className="mb-4">
        <div className="space-y-3">
          {/* Logo Input */}
          <div className={cn(
            "px-2 py-2 rounded border transition-colors",
            hasLogo
              ? "bg-green-500/10 border-green-500/30"
              : "bg-zinc-900/30 border-zinc-700/20"
          )}>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "w-2 h-2 rounded-md",
                hasLogo ? "bg-green-400" : "bg-zinc-500"
              )} />
              <span className="text-xs font-mono text-zinc-400">{t('canvasNodes.brandCore.logo')}</span>
            </div>
            {hasLogo ? (
              <div className="mt-2 relative group/logo">
                <div className="w-16 h-16">
                  <ImageThumbnail
                    base64={logoBase64}
                    index={0}
                    className="w-full h-full"
                  />
                </div>
                {uploadedLogo && !connectedLogo && (
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute top-1 right-1 p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded opacity-0 group-hover/logo:opacity-100 transition-opacity"
                    title={t('canvasNodes.brandCore.removeLogo')}
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
                <NodeButton onClick={handleLogoUploadClick} className="mt-1">
                  <UploadCloud size={14} />
                  {t('canvasNodes.brandCore.uploadLogo')}
                </NodeButton>
                <div className="text-[10px] text-zinc-500 font-mono mt-1">
                  {t('canvasNodes.brandCore.orConnectLogoOrImageNode')}
                </div>
              </>
            )}
          </div>

          {/* Identity Input (PDF or Image) */}
          <div className={cn(
            "px-2 py-2 rounded border transition-colors",
            hasIdentity
              ? "bg-green-500/10 border-green-500/30"
              : "bg-zinc-900/30 border-zinc-700/20"
          )}>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "w-2 h-2 rounded-md",
                hasIdentity ? "bg-green-400" : "bg-zinc-500"
              )} />
              <span className="text-xs font-mono text-zinc-400">{t('canvasNodes.brandCore.identityGuide')}</span>
            </div>
            {hasIdentity ? (
              <div className="mt-2 relative group/identity">
                {connectedPdf ? (
                  <div className="text-[10px] text-zinc-400 font-mono">
                    {t('canvasNodes.brandCore.pdfConnected')}
                  </div>
                ) : connectedImage ? (
                  <ConnectedImagesDisplay
                    images={[connectedImage]}
                    label=""
                    maxThumbnails={1}
                  />
                ) : uploadedIdentityUrl && identityType === 'pdf' ? (
                  <div className="px-3 py-2 bg-zinc-900/50 rounded border border-zinc-700/30 flex items-center gap-3">
                    <FileText size={16} className="text-brand-cyan" />
                    <span className="text-xs font-mono text-zinc-400 flex-1">{t('canvasNodes.brandCore.pdfUploadedR2')}</span>
                  </div>
                ) : uploadedIdentity && identityType === 'png' ? (
                  <div className="w-16 h-16">
                    <ImageThumbnail
                      base64={uploadedIdentity}
                      index={0}
                      className="w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="px-3 py-2 bg-zinc-900/50 rounded border border-zinc-700/30 flex items-center gap-3">
                    <FileText size={16} className="text-brand-cyan" />
                    <span className="text-xs font-mono text-zinc-400 flex-1">{identityType?.toUpperCase()} uploaded</span>
                  </div>
                )}
                {(uploadedIdentity || uploadedIdentityUrl) && !connectedPdf && !connectedImage && (
                  <button
                    onClick={handleRemoveIdentity}
                    className="absolute top-1 right-1 p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded opacity-0 group-hover/identity:opacity-100 transition-opacity"
                    title={t('canvasNodes.brandCore.removeIdentityGuide')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ) : (
              <>
                <input
                  ref={identityInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/jpg"
                  onChange={handleIdentityFileChange}
                  className="hidden"
                />
                <NodeButton onClick={handleIdentityUploadClick} className="mt-1">
                  <FileText size={14} />
                  Upload PDF or PNG
                </NodeButton>
                <div className="text-[10px] text-zinc-500 font-mono mt-1">
                  Or connect a PDF Node or Image Node (PNG)
                </div>
              </>
            )}
          </div>

          {/* Strategy Input */}
          <div className={cn(
            "px-2 py-2 rounded border transition-colors",
            hasStrategies
              ? "bg-green-500/10 border-green-500/30"
              : "bg-zinc-900/30 border-zinc-700/20"
          )}>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "w-2 h-2 rounded-md",
                hasStrategies ? "bg-green-400" : "bg-zinc-500"
              )} />
              <span className="text-xs font-mono text-zinc-400">Strategy</span>
            </div>
            {hasStrategies ? (
              <div className="text-[10px] text-zinc-400 font-mono mt-1">
                {connectedStrategies.length} Strategy Node(s) Connected
              </div>
            ) : (
              <div className="text-[10px] text-zinc-500 font-mono mt-1">
                Connect Strategy Node(s) (optional)
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Analyze Button */}
      {canAnalyze && (
        <NodeButton
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          variant="primary"
          className="mb-4"
        >
          {isAnalyzing ? (
            <>
              <GlitchLoader size={14} />
              Analyzing...
            </>
          ) : (
            <>
              <Dna size={14} />
              Analyze Brand Identity
            </>
          )}
        </NodeButton>
      )}

      {/* Analysis Status */}
      {isAnalyzing && (
        <div className="mb-4 px-3 py-2 bg-brand-cyan/20 border border-[#52ddeb]/30 rounded flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GlitchLoader size={14} color="#52ddeb" />
            <span className="text-xs font-mono text-brand-cyan">Analyzing brand identity...</span>
          </div>
          {nodeData.onCancelAnalyze && (
            <button
              onClick={() => nodeData.onCancelAnalyze?.(id)}
              className="p-1 hover:bg-brand-cyan/30 rounded transition-colors"
              title={t('canvasNodes.brandCore.cancelAnalysis')}
            >
              <X size={14} className="text-brand-cyan" />
            </button>
          )}
        </div>
      )}

      {/* Brand Identity Display */}
      {brandIdentity && (
        <div className="border-t border-zinc-700/30 pt-4 mb-4">
          <button
            onClick={() => setIsExpandedBrandIdentity(!isExpandedBrandIdentity)}
            className="w-full flex items-center justify-between text-xs font-mono text-zinc-400 hover:text-zinc-300 mb-2"
          >
            <span>Brand Identity</span>
            {isExpandedBrandIdentity ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isExpandedBrandIdentity && (
            <div className="space-y-3 text-xs">
              {/* Logo Details */}
              {(brandIdentity.logo.colors.length > 0 || brandIdentity.logo.style || brandIdentity.logo.elements.length > 0) && (
                <div>
                  <div className="text-zinc-500 font-mono mb-1">Logo</div>
                  <div className="space-y-3">
                    {brandIdentity.logo.colors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {brandIdentity.logo.colors.map((color, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900/50 rounded border border-zinc-700/30"
                          >
                            <div
                              className="w-2.5 h-2.5 rounded border border-zinc-700/50"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-zinc-400 font-mono text-[10px]">{color}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {brandIdentity.logo.style && (
                      <div className="text-zinc-400">
                        <span className="text-zinc-500 text-[10px]">Style: </span>
                        {brandIdentity.logo.style}
                      </div>
                    )}
                    {brandIdentity.logo.elements.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {brandIdentity.logo.elements.map((element, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-zinc-900/50 rounded border border-zinc-700/30 text-zinc-400 text-[10px]">
                            {element}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Brand Colors */}
              {(brandIdentity.colors.primary.length > 0 || brandIdentity.colors.secondary.length > 0 || brandIdentity.colors.accent.length > 0) && (
                <div>
                  <div className="text-zinc-500 font-mono mb-1">Brand Colors</div>
                  <div className="space-y-1.5">
                    {brandIdentity.colors.primary.length > 0 && (
                      <div>
                        <div className="text-zinc-500 text-[10px] mb-1">Primary</div>
                        <div className="flex flex-wrap gap-1.5">
                          {brandIdentity.colors.primary.map((color, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900/50 rounded border border-zinc-700/30"
                            >
                              <div
                                className="w-2.5 h-2.5 rounded border border-zinc-700/50"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-zinc-400 font-mono text-[10px]">{color}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {brandIdentity.colors.secondary.length > 0 && (
                      <div>
                        <div className="text-zinc-500 text-[10px] mb-1">Secondary</div>
                        <div className="flex flex-wrap gap-1.5">
                          {brandIdentity.colors.secondary.map((color, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900/50 rounded border border-zinc-700/30"
                            >
                              <div
                                className="w-2.5 h-2.5 rounded border border-zinc-700/50"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-zinc-400 font-mono text-[10px]">{color}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {brandIdentity.colors.accent.length > 0 && (
                      <div>
                        <div className="text-zinc-500 text-[10px] mb-1">Accent</div>
                        <div className="flex flex-wrap gap-1.5">
                          {brandIdentity.colors.accent.map((color, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900/50 rounded border border-zinc-700/30"
                            >
                              <div
                                className="w-2.5 h-2.5 rounded border border-zinc-700/50"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-zinc-400 font-mono text-[10px]">{color}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Typography */}
              {(brandIdentity.typography.primary || brandIdentity.typography.weights?.length > 0) && (
                <div>
                  <div className="text-zinc-500 font-mono mb-1">Typography</div>
                  <div className="space-y-1">
                    {brandIdentity.typography.primary && (
                      <div className="text-zinc-400">
                        <span className="text-zinc-500 text-[10px]">Primary: </span>
                        {brandIdentity.typography.primary}
                      </div>
                    )}
                    {brandIdentity.typography.secondary && (
                      <div className="text-zinc-400">
                        <span className="text-zinc-500 text-[10px]">Secondary: </span>
                        {brandIdentity.typography.secondary}
                      </div>
                    )}
                    {brandIdentity.typography.weights && brandIdentity.typography.weights.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {brandIdentity.typography.weights.map((weight, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-zinc-900/50 rounded border border-zinc-700/30 text-zinc-400 text-[10px]">
                            {weight}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Composition */}
              {(brandIdentity.composition.style || brandIdentity.composition.grid || brandIdentity.composition.spacing) && (
                <div>
                  <div className="text-zinc-500 font-mono mb-1">Composition</div>
                  <div className="space-y-1 text-zinc-400">
                    {brandIdentity.composition.style && (
                      <div>
                        <span className="text-zinc-500 text-[10px]">Style: </span>
                        {brandIdentity.composition.style}
                      </div>
                    )}
                    {brandIdentity.composition.grid && (
                      <div>
                        <span className="text-zinc-500 text-[10px]">Grid: </span>
                        {brandIdentity.composition.grid}
                      </div>
                    )}
                    {brandIdentity.composition.spacing && (
                      <div>
                        <span className="text-zinc-500 text-[10px]">Spacing: </span>
                        {brandIdentity.composition.spacing}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Personality */}
              {(brandIdentity.personality.tone || brandIdentity.personality.feeling || brandIdentity.personality.values?.length > 0) && (
                <div>
                  <div className="text-zinc-500 font-mono mb-1">Personality</div>
                  <div className="space-y-1 text-zinc-400">
                    {brandIdentity.personality.tone && (
                      <div>
                        <span className="text-zinc-500 text-[10px]">Tone: </span>
                        {brandIdentity.personality.tone}
                      </div>
                    )}
                    {brandIdentity.personality.feeling && (
                      <div>
                        <span className="text-zinc-500 text-[10px]">Feeling: </span>
                        {brandIdentity.personality.feeling}
                      </div>
                    )}
                    {brandIdentity.personality.values && brandIdentity.personality.values.length > 0 && (
                      <div>
                        <div className="text-zinc-500 text-[10px] mb-1">Values</div>
                        <div className="flex flex-wrap gap-1">
                          {brandIdentity.personality.values.map((value, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-zinc-900/50 rounded border border-zinc-700/30 text-zinc-400 text-[10px]">
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Visual Elements */}
              {brandIdentity.visualElements.length > 0 && (
                <div>
                  <div className="text-zinc-500 font-mono mb-1">Visual Elements</div>
                  <div className="flex flex-wrap gap-1">
                    {brandIdentity.visualElements.slice(0, 8).map((element, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 bg-zinc-900/50 rounded border border-zinc-700/30 text-zinc-400 text-[10px]">
                        {element}
                      </span>
                    ))}
                    {brandIdentity.visualElements.length > 8 && (
                      <span className="text-zinc-500 text-[10px]">+{brandIdentity.visualElements.length - 8} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Visual Prompts Section */}
      {visualPrompts && (
        <div className="border-t border-zinc-700/30 pt-4 mb-4">
          <button
            onClick={() => setIsExpandedVisual(!isExpandedVisual)}
            className="w-full flex items-center justify-between text-xs font-mono text-zinc-400 hover:text-zinc-300 mb-2"
          >
            <span>Visual Prompts</span>
            {isExpandedVisual ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isExpandedVisual && (
            <div className="space-y-3">
              {visualPrompts.mockupPrompt && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-zinc-500 font-mono">Mockup Prompt</div>
                    <button
                      onClick={() => handleCopyPrompt(visualPrompts.mockupPrompt!, 'mockup')}
                      className="p-1 hover:bg-zinc-800 rounded"
                    >
                      {copiedPrompt === 'mockup' ? (
                        <Check size={12} className="text-green-400" />
                      ) : (
                        <Copy size={12} className="text-zinc-400" />
                      )}
                    </button>
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono bg-zinc-900/50 p-2 rounded border border-zinc-700/30 max-h-32 overflow-y-auto">
                    {visualPrompts.mockupPrompt}
                  </div>
                </div>
              )}

              {visualPrompts.compositionPrompt && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-zinc-500 font-mono">Composition Prompt</div>
                    <button
                      onClick={() => handleCopyPrompt(visualPrompts.compositionPrompt!, 'composition')}
                      className="p-1 hover:bg-zinc-800 rounded"
                    >
                      {copiedPrompt === 'composition' ? (
                        <Check size={12} className="text-green-400" />
                      ) : (
                        <Copy size={12} className="text-zinc-400" />
                      )}
                    </button>
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono bg-zinc-900/50 p-2 rounded border border-zinc-700/30 max-h-24 overflow-y-auto">
                    {visualPrompts.compositionPrompt}
                  </div>
                </div>
              )}

              {visualPrompts.stylePrompt && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-zinc-500 font-mono">Style Prompt</div>
                    <button
                      onClick={() => handleCopyPrompt(visualPrompts.stylePrompt!, 'style')}
                      className="p-1 hover:bg-zinc-800 rounded"
                    >
                      {copiedPrompt === 'style' ? (
                        <Check size={12} className="text-green-400" />
                      ) : (
                        <Copy size={12} className="text-zinc-400" />
                      )}
                    </button>
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono bg-zinc-900/50 p-2 rounded border border-zinc-700/30 max-h-24 overflow-y-auto">
                    {visualPrompts.stylePrompt}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Strategic Prompts Section */}
      {strategicPrompts?.consolidated && (
        <div className="border-t border-zinc-700/30 pt-3">
          <div
            onClick={() => setIsExpandedStrategic(!isExpandedStrategic)}
            className="w-full flex items-center justify-between text-xs font-mono text-zinc-400 hover:text-zinc-300 mb-2 cursor-pointer"
          >
            <span>Strategic Prompts (Consolidated)</span>
            {isExpandedStrategic ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>

          {isExpandedStrategic && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-zinc-500 font-mono">Consolidated Strategy</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const consolidatedText = consolidateStrategiesToText(strategicPrompts.consolidated);
                    handleCopyPrompt(consolidatedText, 'strategic');
                  }}
                  className="p-1 hover:bg-zinc-800 rounded"
                >
                  {copiedPrompt === 'strategic' ? (
                    <Check size={12} className="text-green-400" />
                  ) : (
                    <Copy size={12} className="text-zinc-400" />
                  )}
                </button>
              </div>
              <div className="text-[10px] text-zinc-400 font-mono bg-zinc-900/50 p-2 rounded border border-zinc-700/30 max-h-64 overflow-y-auto whitespace-pre-wrap">
                {consolidateStrategiesToText(strategicPrompts.consolidated)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generating Prompts Status */}
      {isGeneratingPrompts && (
        <div className="mt-4 px-3 py-2 bg-brand-cyan/20 border border-[#52ddeb]/30 rounded flex items-center gap-3">
          <GlitchLoader size={14} color="#52ddeb" />
          <span className="text-xs font-mono text-brand-cyan">Generating prompts...</span>
        </div>
      )}
    </NodeContainer>
  );
});

BrandCore.displayName = 'BrandCore';
