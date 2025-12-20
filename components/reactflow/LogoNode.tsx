import React, { useRef, memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { UploadCloud, X } from 'lucide-react';
import type { LogoNodeData } from '../../types/reactFlow';
import { cn } from '../../lib/utils';
import { fileToBase64 } from '../../utils/fileUtils';
import { toast } from 'sonner';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeButton } from './shared/node-button';
import { useTranslation } from '../../hooks/useTranslation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LogoNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const nodeData = data as LogoNodeData;
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const logoBase64 = nodeData.logoBase64;
  const logoImageUrl = logoBase64 ? `data:image/png;base64,${logoBase64}` : nodeData.logoImageUrl;

  const handleLogoUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    logoInputRef.current?.click();
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nodeData.onUploadLogo) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('canvasNodes.logoNode.pleaseSelectImageFile'), { duration: 3000 });
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('canvasNodes.logoNode.fileSizeExceedsLimit'), { duration: 5000 });
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
      toast.success(t('canvasNodes.logoNode.logoUploadedSuccessfully'), { duration: 2000 });
    } catch (error: any) {
      toast.error(error?.message || t('canvasNodes.logoNode.failedToProcessLogo'), { duration: 5000 });
      console.error('Failed to process logo:', error);
    }
  };

  const handleRemoveLogo = () => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, { logoBase64: undefined, logoImageUrl: undefined });
    }
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="p-5 min-w-[240px] max-w-[300px]"
    >
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="logo-output"
        className="w-2 h-2 bg-[#52ddeb] border-2 border-black node-handle"
      />

      {/* Header */}
      <NodeHeader icon={UploadCloud} title={t('canvasNodes.logoNode.title')} />

      {/* Logo Upload Section */}
      {logoImageUrl ? (
        <div className="relative group/logo">
          <div className="relative w-full h-32 bg-zinc-900/50 rounded border border-zinc-700/30 overflow-hidden">
            <img
              src={logoImageUrl}
              alt={t('canvasNodes.logoNode.logoAltText')}
              className="w-full h-full object-contain p-2"
            />
          </div>
          <button
            onClick={handleRemoveLogo}
            className="absolute top-1 right-1 p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded opacity-0 group-hover/logo:opacity-100 transition-opacity"
            title={t('canvasNodes.logoNode.removeLogo')}
          >
            <X size={12} />
          </button>
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
            {t('canvasNodes.logoNode.uploadLogo')}
          </NodeButton>
        </>
      )}
    </NodeContainer>
  );
});

LogoNode.displayName = 'LogoNode';
