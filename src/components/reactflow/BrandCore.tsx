import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { LabeledHandle } from './shared/LabeledHandle';
import {
  Palette,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  UploadCloud,
  FileText,
  X,
  Maximize2,
} from '@/lib/ui/icons';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { BrandCoreData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { Thumb } from '@/components/ui/Thumb';
import { toast } from 'sonner';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/useTranslation';
import { NodeButton } from './shared/node-button';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { fileToBase64, validateFile } from '@/utils/fileUtils';
import { pdfToBase64, validatePdfBase64Size, validatePdfFile } from '@/utils/pdfUtils';
import { normalizeImageToBase64 } from '@/services/reactFlowService';
import { consolidateStrategiesToText } from '@/services/brandPromptService';
import { copyToClipboard } from '@/utils/clipboard';

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
  const identityBase64 =
    connectedPdf ||
    connectedImage ||
    (uploadedIdentityUrl && uploadedIdentityType === 'pdf'
      ? uploadedIdentityUrl
      : uploadedIdentity);
  const identityType: 'pdf' | 'png' | undefined = connectedPdf
    ? 'pdf'
    : connectedImage
      ? 'png'
      : uploadedIdentityType;

  // Auto-expand when brandIdentity is added
  useEffect(() => {
    if (brandIdentity && !isExpandedBrandIdentity) {
      setIsExpandedBrandIdentity(true);
    }
  }, [brandIdentity, isExpandedBrandIdentity]);

  // Auto-generate visual prompts when brandIdentity is available
  useEffect(() => {
    if (
      brandIdentity &&
      !visualPrompts &&
      !isGeneratingPrompts &&
      nodeData.onGenerateVisualPrompts
    ) {
      nodeData.onGenerateVisualPrompts(id);
    }
  }, [brandIdentity, visualPrompts, isGeneratingPrompts, id, nodeData]);

  // Auto-consolidate strategies when strategies are connected
  useEffect(() => {
    if (
      connectedStrategies.length > 0 &&
      !strategicPrompts?.consolidated &&
      nodeData.onGenerateStrategicPrompts
    ) {
      nodeData.onGenerateStrategicPrompts(id);
    }
  }, [connectedStrategies, strategicPrompts, id, nodeData]);

  const handleCopyPrompt = useCallback((prompt: string, type: string) => {
    copyToClipboard(prompt);
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
    if (logoInputRef.current) logoInputRef.current.value = '';
    if (!file || !nodeData.onUpdateData) return;

    const error = validateFile(file, 'image');
    if (error) {
      toast.error(error, { duration: 3000 });
      return;
    }

    try {
      const imageData = await fileToBase64(file);
      nodeData.onUpdateData(id, { uploadedLogo: imageData.base64 });
      toast.success(t('canvasNodes.brandCore.logoUploadedSuccessfully'), { duration: 2000 });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to process logo image', { duration: 5000 });
    }
  };

  const handleIdentityFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (identityInputRef.current) identityInputRef.current.value = '';
    if (!file || !nodeData.onUpdateData) return;

    const validationError = validateFile(file, ['image', 'pdf']);
    if (validationError) {
      toast.error(validationError, { duration: 5000 });
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const fileType: 'pdf' | 'png' = isPdf ? 'pdf' : 'png';
    let base64: string;

    if (isPdf) {
      const pdfValidation = validatePdfFile(file);
      if (!pdfValidation.isValid) {
        toast.error(pdfValidation.error || 'Invalid PDF file', { duration: 5000 });
        return;
      }
      try {
        base64 = await pdfToBase64(file);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to process PDF', { duration: 5000 });
        return;
      }
    } else {
      try {
        base64 = (await fileToBase64(file)).base64;
      } catch (err: any) {
        toast.error(err?.message || 'Failed to process image', { duration: 5000 });
        return;
      }
    }

    try {
      console.log('[BrandCore] Processing identity file upload', {
        nodeId: id,
        fileName: file.name,
        fileType,
        fileSize: file.size,
        hasOnUploadPdfToR2: !!nodeData.onUploadPdfToR2,
        hasOnUpdateData: !!nodeData.onUpdateData,
      });

      // Para PDF: fazer upload direto para R2 (não armazenar base64)
      if (fileType === 'pdf' && nodeData.onUploadPdfToR2) {
        // Validate base64 size before upload to prevent 413 errors
        const sizeValidation = validatePdfBase64Size(base64);
        if (!sizeValidation.isValid) {
          toast.error(sizeValidation.error || 'PDF is too large for upload', { duration: 5000 });
          return;
        }

        toast.loading('Uploading PDF to cloud storage...', { id: 'pdf-upload' });
        const pdfUrl = await nodeData.onUploadPdfToR2(id, base64);
        console.log('[BrandCore] PDF uploaded successfully to R2', { nodeId: id, pdfUrl });
        toast.success(t('canvasNodes.brandCore.pdfUploadedSuccessfully'), {
          id: 'pdf-upload',
          duration: 2000,
        });
      } else {
        // Para imagens PNG: armazenar base64 (menor que PDF)
        if (fileType === 'pdf' && !nodeData.onUploadPdfToR2) {
          console.warn(
            '[BrandCore] PDF upload requested but onUploadPdfToR2 handler not available, falling back to base64',
            { nodeId: id }
          );
        }
        nodeData.onUpdateData(id, {
          uploadedIdentity: base64,
          uploadedIdentityType: fileType,
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
        uploadedIdentityType: undefined,
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
    <NodeContainer selected={selected} dragging={dragging} className="min-w-[360px] max-w-[450px]">
      {/* Input Handles */}
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="image-input"
        label={t('canvasNodes.brandCore.logo')}
        style={{ top: '90px' }}
      />
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="pdf-input"
        label={t('canvasNodes.brandCore.identityGuide')}
        style={{ top: '180px' }}
      />
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="strategy-input"
        label={t('canvasNodes.brandCore.strategy')}
        style={{ top: '270px' }}
      />

      {/* Smart Output Handle - detects node type and provides appropriate data */}
      <LabeledHandle
        type="source"
        position={Position.Right}
        id="prompt-output"
        label={t('canvasNodes.brandCore.output')}
        style={{ top: '50px' }}
      />

      {/* Header */}
      <NodeHeader icon={Palette} title={t('canvasNodes.brandCore.title')} selected={selected} />

      <div className="p-4 flex flex-col gap-[var(--node-gap)]">
        {/* Inputs Section */}
        <div className="space-y-4">
          {/* Logo Input */}
          <div
            className={cn(
              'p-3 rounded-md border-node transition-colors duration-300',
              hasLogo
                ? 'bg-neutral-900/60 border-neutral-700'
                : 'bg-neutral-900/40 border-neutral-700/30'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    hasLogo ? 'bg-success' : 'bg-neutral-600'
                  )}
                />
                <span className="text-2xs font-medium text-neutral-400">
                  {t('canvasNodes.brandCore.logo')}
                </span>
              </div>
              {hasLogo && uploadedLogo && !connectedLogo && (
                <NodeButton
                  variant="ghost"
                  size="xs"
                  onClick={handleRemoveLogo}
                  aria-label={t('canvasNodes.brandCore.removeLogo')}
                  className="h-6 w-6 text-neutral-500 hover:text-destructive p-0"
                >
                  <X size={12} />
                </NodeButton>
              )}
            </div>

            {hasLogo ? (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-md overflow-hidden bg-neutral-950/40 border-node border-neutral-700/50 p-1 flex items-center justify-center shadow-inner">
                  <Thumb
                    src={
                      logoBase64.startsWith('data:')
                        ? logoBase64
                        : `data:image/png;base64,${logoBase64}`
                    }
                    alt={t('canvasNodes.brandCore.logo')}
                    className="max-w-full max-h-full object-contain"
                    fallbackClassName="w-full h-full"
                  />
                </div>
                <div className="flex-1">
                  <div className="text-2xs font-medium text-neutral-400">
                    {t('canvasNodes.brandCore.connected')}
                  </div>
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
                <NodeButton
                  variant="primary"
                  size="full"
                  onClick={handleLogoUploadClick}
                  className="shadow-sm"
                >
                  <UploadCloud size={14} className="mr-2" />
                  {t('canvasNodes.brandCore.uploadLogo')}
                </NodeButton>
                <div className="text-2xs text-neutral-600 text-center">
                  {t('canvasNodes.brandCore.orConnectLogoOrImageNode')}
                </div>
              </div>
            )}
          </div>

          {/* Identity Input (PDF or Image) */}
          <div
            className={cn(
              'p-3 rounded-md border-node transition-colors duration-300',
              hasIdentity
                ? 'bg-neutral-900/60 border-neutral-700'
                : 'bg-neutral-900/40 border-neutral-700/30'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    hasIdentity ? 'bg-success' : 'bg-neutral-600'
                  )}
                />
                <span className="text-2xs font-medium text-neutral-400">
                  {t('canvasNodes.brandCore.identityGuide')}
                </span>
              </div>
              {(uploadedIdentity || uploadedIdentityUrl) && !connectedPdf && !connectedImage && (
                <NodeButton
                  variant="ghost"
                  size="xs"
                  onClick={handleRemoveIdentity}
                  aria-label={t('canvasNodes.brandCore.removeIdentityGuide')}
                  className="h-6 w-6 text-neutral-500 hover:text-destructive p-0"
                >
                  <X size={12} />
                </NodeButton>
              )}
            </div>

            {hasIdentity ? (
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-md bg-neutral-950/40 border-node border-neutral-700/50 shadow-inner">
                  <FileText size={20} className="text-neutral-400" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-2xs font-medium text-neutral-400">
                    {t('canvasNodes.brandCore.fileConnected', {
                      type: identityType?.toUpperCase() || 'PDF',
                    })}
                  </div>
                  <div className="text-2xs text-neutral-400 line-clamp-1 opacity-60">
                    {connectedPdf
                      ? t('common.referenceDocument')
                      : connectedImage
                        ? t('canvasNodes.brandCore.styleReference')
                        : t('common.localUpload')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  ref={identityInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/jpg"
                  onChange={handleIdentityFileChange}
                  className="hidden"
                />
                <NodeButton
                  variant="primary"
                  size="full"
                  onClick={handleIdentityUploadClick}
                  className="shadow-sm"
                >
                  <FileText size={14} className="mr-2" />
                  {t('canvasNodes.brandCore.uploadIdentity')}
                </NodeButton>
                <div className="text-2xs text-neutral-600 text-center">
                  {t('canvasNodes.brandCore.orConnectPdfOrImageNode')}
                </div>
              </div>
            )}
          </div>

          {/* Strategy Input */}
          <div
            className={cn(
              'p-3 rounded-md border-node transition-colors duration-300',
              hasStrategies
                ? 'bg-neutral-900/60 border-neutral-700'
                : 'bg-neutral-900/40 border-neutral-700/30'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  hasStrategies ? 'bg-success' : 'bg-neutral-600'
                )}
              />
              <span className="text-2xs font-medium text-neutral-400">
                {t('canvasNodes.brandCore.strategy')}
              </span>
            </div>
            <div className="text-2xs text-neutral-500 pl-3.5">
              {hasStrategies
                ? t('canvasNodes.brandCore.strategiesConnected', {
                    count: connectedStrategies.length,
                  })
                : t('canvasNodes.brandCore.connectStrategies')}
            </div>
          </div>
        </div>

        {/* Analyze Button */}
        {canAnalyze && (
          <NodeButton onClick={handleAnalyze} disabled={!canAnalyze} variant="primary" size="full">
            {isAnalyzing ? (
              <>
                <GlitchLoader size={14} className="mr-2" color="currentColor" />
                <span>{t('canvasNodes.brandCore.analyzing')}</span>
              </>
            ) : (
              <>
                <Palette size={14} className="mr-2" />
                <span>{t('canvasNodes.brandCore.analyze')}</span>
              </>
            )}
          </NodeButton>
        )}

        {/* Analysis Status */}
        {isAnalyzing && (
          <div className="px-3 py-2.5 bg-muted border-node border-neutral-800 rounded-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-full bg-muted-foreground/15">
                <GlitchLoader size={12} />
              </div>
              <span className="text-2xs text-foreground font-medium">
                {t('canvasNodes.brandCore.analyzing')}
              </span>
            </div>
            {nodeData.onCancelAnalyze && (
              <NodeButton
                variant="ghost"
                size="xs"
                onClick={() => nodeData.onCancelAnalyze?.(id)}
                aria-label={t('canvasNodes.brandCore.cancelAnalysis')}
                className="h-6 w-6 text-foreground hover:bg-neutral-800"
              >
                <X size={14} />
              </NodeButton>
            )}
          </div>
        )}

        {/* Brand Identity Display */}
        {brandIdentity && (
          <div className="border-t border-neutral-700/30 pt-4">
            <NodeButton
              variant="ghost"
              size="full"
              onClick={() => setIsExpandedBrandIdentity(!isExpandedBrandIdentity)}
              className="flex items-center justify-between group/expand px-1"
            >
              <span className="text-2xs font-medium text-neutral-500 group-hover/expand:text-neutral-300 transition-colors">
                {t('canvasNodes.brandCore.identity')}
              </span>
              <div className="p-1 rounded-full bg-neutral-900/50 group-hover/expand:bg-neutral-800 transition-colors">
                {isExpandedBrandIdentity ? (
                  <ChevronUp size={12} className="text-neutral-400" />
                ) : (
                  <ChevronDown size={12} className="text-neutral-400" />
                )}
              </div>
            </NodeButton>

            {isExpandedBrandIdentity && (
              <div className="mt-4 space-y-4 text-2xs animate-in fade-in slide-in-from-top-1 duration-300">
                {/* Logo Details */}
                {(brandIdentity.logo.colors.length > 0 ||
                  brandIdentity.logo.style ||
                  brandIdentity.logo.elements.length > 0) && (
                  <div className="p-2.5 rounded-md bg-neutral-900/40 border-node border-neutral-700/20">
                    <div className="text-2xs font-medium text-neutral-500 mb-2">
                      {t('canvasNodes.brandCore.logoDna')}
                    </div>
                    <div className="space-y-3">
                      {brandIdentity.logo.colors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {brandIdentity.logo.colors.map((color, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 px-2 py-1 bg-neutral-950/40 rounded border-node border-neutral-700/30 shadow-sm"
                            >
                              <div
                                className="w-2.5 h-2.5 rounded border-node border-border shadow-sm"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-neutral-400 font-mono text-2xs">{color}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-1.5 border-t border-neutral-700/20 pt-2 text-neutral-300 leading-relaxed">
                        {brandIdentity.logo.style && (
                          <div className="flex gap-2">
                            <span className="text-neutral-500 text-2xs shrink-0">
                              {t('canvasNodes.brandCore.style')}
                            </span>
                            <span>{brandIdentity.logo.style}</span>
                          </div>
                        )}
                        {brandIdentity.logo.elements.length > 0 && (
                          <div className="flex gap-2">
                            <span className="text-neutral-500 text-2xs shrink-0">
                              {t('canvasNodes.brandCore.traits')}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {brandIdentity.logo.elements.map((element, idx) => (
                                <span
                                  key={idx}
                                  className="after:content-[','] last:after:content-[''] mr-0.5"
                                >
                                  {element}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Brand Colors - Simplified but elegant */}
                {(brandIdentity.colors.primary.length > 0 ||
                  brandIdentity.colors.secondary.length > 0 ||
                  brandIdentity.colors.accent.length > 0) && (
                  <div className="p-2.5 rounded-md bg-neutral-900/40 border-node border-neutral-700/20">
                    <div className="text-2xs font-medium text-neutral-500 mb-2">
                      {t('canvasNodes.brandCore.palettes')}
                    </div>
                    <div className="space-y-3">
                      {[
                        {
                          label: t('canvasNodes.brandCore.primary'),
                          palette: brandIdentity.colors.primary,
                        },
                        {
                          label: t('canvasNodes.brandCore.secondary'),
                          palette: brandIdentity.colors.secondary,
                        },
                        {
                          label: t('canvasNodes.brandCore.accent'),
                          palette: brandIdentity.colors.accent,
                        },
                      ].map(
                        ({ label, palette }) =>
                          palette.length > 0 && (
                            <div key={label} className="space-y-1.5">
                              <div className="text-2xs text-neutral-600">{label}</div>
                              <div className="flex flex-wrap gap-1.5">
                                {palette.map((color, idx) => (
                                  <div key={idx} className="group/color relative">
                                    <div
                                      className="w-6 h-6 rounded border-node border-border"
                                      title={color}
                                      style={{ backgroundColor: color }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                      )}
                    </div>
                  </div>
                )}

                {/* Personality & Tone */}
                {(brandIdentity.personality.tone ||
                  brandIdentity.personality.feeling ||
                  brandIdentity.personality.values?.length > 0) && (
                  <div className="p-2.5 rounded-md bg-neutral-900/40 border-node border-neutral-700/20">
                    <div className="text-2xs font-medium text-neutral-500 mb-2">
                      {t('canvasNodes.brandCore.personality')}
                    </div>
                    <div className="space-y-2.5 text-neutral-400">
                      <div className="grid grid-cols-2 gap-3">
                        {brandIdentity.personality.tone && (
                          <div className="space-y-0.5">
                            <span className="text-neutral-600 text-2xs">
                              {t('canvasNodes.brandCore.tone')}
                            </span>
                            <div className="text-neutral-300 line-clamp-2">
                              {brandIdentity.personality.tone}
                            </div>
                          </div>
                        )}
                        {brandIdentity.personality.feeling && (
                          <div className="space-y-0.5">
                            <span className="text-neutral-600 text-2xs">
                              {t('canvasNodes.brandCore.vibe')}
                            </span>
                            <div className="text-neutral-300 line-clamp-2">
                              {brandIdentity.personality.feeling}
                            </div>
                          </div>
                        )}
                      </div>

                      {brandIdentity.personality.values &&
                        brandIdentity.personality.values.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1.5 border-t border-neutral-700/10">
                            {brandIdentity.personality.values.map((value, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-neutral-950/40 rounded text-2xs text-neutral-400 border-node border-neutral-800"
                              >
                                {value}
                              </span>
                            ))}
                          </div>
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
          <div className="border-t border-neutral-700/30 pt-4 mb-4">
            <NodeButton
              variant="ghost"
              size="full"
              onClick={() => setIsExpandedVisual(!isExpandedVisual)}
              className="flex items-center justify-between text-xs text-neutral-400 hover:text-neutral-300 mb-2 px-3"
            >
              <span>{t('canvasNodes.brandCore.visualPrompts')}</span>
              {isExpandedVisual ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </NodeButton>

            {isExpandedVisual && (
              <div className="space-y-3">
                {visualPrompts.mockupPrompt && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-neutral-500">
                        {t('canvasNodes.brandCore.mockupPrompt')}
                      </div>
                      <NodeButton
                        variant="ghost"
                        size="xs"
                        onClick={() => handleCopyPrompt(visualPrompts.mockupPrompt!, 'mockup')}
                        aria-label={t('canvasNodes.brandCore.copyPrompt')}
                        className="p-1 hover:bg-neutral-800 rounded"
                      >
                        {copiedPrompt === 'mockup' ? (
                          <Check size={12} className="text-success" />
                        ) : (
                          <Copy size={12} className="text-neutral-400" />
                        )}
                      </NodeButton>
                    </div>
                    <div className="text-2xs text-neutral-400 font-mono bg-neutral-900/50 p-2 rounded border-node border-neutral-700/30 max-h-32 overflow-y-auto">
                      {visualPrompts.mockupPrompt}
                    </div>
                  </div>
                )}

                {visualPrompts.compositionPrompt && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-neutral-500">
                        {t('canvasNodes.brandCore.compositionPrompt')}
                      </div>
                      <NodeButton
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          handleCopyPrompt(visualPrompts.compositionPrompt!, 'composition')
                        }
                        className="p-1 hover:bg-neutral-800 rounded"
                      >
                        {copiedPrompt === 'composition' ? (
                          <Check size={12} className="text-success" />
                        ) : (
                          <Copy size={12} className="text-neutral-400" />
                        )}
                      </NodeButton>
                    </div>
                    <div className="text-2xs text-neutral-400 font-mono bg-neutral-900/50 p-2 rounded border-node border-neutral-700/30 max-h-24 overflow-y-auto">
                      {visualPrompts.compositionPrompt}
                    </div>
                  </div>
                )}

                {visualPrompts.stylePrompt && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-neutral-500">
                        {t('canvasNodes.brandCore.stylePrompt')}
                      </div>
                      <NodeButton
                        variant="ghost"
                        size="xs"
                        onClick={() => handleCopyPrompt(visualPrompts.stylePrompt!, 'style')}
                        aria-label={t('canvasNodes.brandCore.copyPrompt')}
                        className="p-1 hover:bg-neutral-800 rounded"
                      >
                        {copiedPrompt === 'style' ? (
                          <Check size={12} className="text-success" />
                        ) : (
                          <Copy size={12} className="text-neutral-400" />
                        )}
                      </NodeButton>
                    </div>
                    <div className="text-2xs text-neutral-400 font-mono bg-neutral-900/50 p-2 rounded border-node border-neutral-700/30 max-h-24 overflow-y-auto">
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
          <div className="border-t border-neutral-700/30 pt-3">
            <button
              type="button"
              onClick={() => setIsExpandedStrategic(!isExpandedStrategic)}
              aria-expanded={isExpandedStrategic}
              className="w-full flex items-center justify-between text-xs text-neutral-400 hover:text-neutral-300 mb-2"
            >
              <span>{t('canvasNodes.brandCore.strategicPrompts')}</span>
              {isExpandedStrategic ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {isExpandedStrategic && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-neutral-500">
                    {t('canvasNodes.brandCore.consolidatedStrategy')}
                  </div>
                  <NodeButton
                    variant="ghost"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      const consolidatedText = consolidateStrategiesToText(
                        strategicPrompts.consolidated
                      );
                      handleCopyPrompt(consolidatedText, 'strategic');
                    }}
                    className="p-1 hover:bg-neutral-800 rounded"
                  >
                    {copiedPrompt === 'strategic' ? (
                      <Check size={12} className="text-success" />
                    ) : (
                      <Copy size={12} className="text-neutral-400" />
                    )}
                  </NodeButton>
                </div>
                <div className="text-2xs text-neutral-400 font-mono bg-neutral-900/50 p-2 rounded border-node border-neutral-700/30 max-h-64 overflow-y-auto whitespace-pre-wrap">
                  {consolidateStrategiesToText(strategicPrompts.consolidated)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generating Prompts Status */}
        {isGeneratingPrompts && (
          <div className="mt-4 px-3 py-2 bg-muted border-node border-neutral-800 rounded flex items-center gap-3">
            <GlitchLoader size={14} />
            <span className="text-xs text-foreground">
              {t('canvasNodes.brandCore.generatingPrompts')}
            </span>
          </div>
        )}
      </div>
    </NodeContainer>
  );
});

BrandCore.displayName = 'BrandCore';
