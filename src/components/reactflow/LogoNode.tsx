import React, { useRef, memo, useCallback, useState, useEffect } from 'react';
import { Position, NodeResizer, type NodeProps, useReactFlow, Handle } from '@xyflow/react';
import { UploadCloud, X } from 'lucide-react';
import type { LogoNodeData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { fileToBase64, validateFile } from '@/utils/fileUtils';
import { toast } from 'sonner';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeButton } from './shared/node-button';
import { NodeActionBar } from './shared/NodeActionBar';
import { ImageNodeActionButtons } from './shared/ImageNodeActionButtons';
import { useTranslation } from '@/hooks/useTranslation';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { ConfirmationModal } from '../ConfirmationModal';
import { Input } from '@/components/ui/input'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LogoNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const { setNodes, getZoom } = useReactFlow();
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const nodeData = data as LogoNodeData;
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const logoBase64 = nodeData.logoBase64;
  const logoImageUrl = logoBase64 ? `data:image/png;base64,${logoBase64}` : nodeData.logoImageUrl;

  const handleLogoUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    logoInputRef.current?.click();
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
      toast.success(t('canvasNodes.logoNode.logoUploadedSuccessfully'), { duration: 2000 });
    } catch (err: any) {
      toast.error(err?.message || t('canvasNodes.logoNode.failedToProcessLogo'), { duration: 5000 });
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

  const handleFitToContent = useCallback(() => {
    // For LogoNode, we use the image dimensions if available
    const width = nodeData.imageWidth;
    const height = nodeData.imageHeight;

    if (width && height) {
      // Calculate a reasonable size if image is too large
      let targetWidth = width;
      let targetHeight = height;
      const MAX_FIT_WIDTH = 1000;

      if (targetWidth > MAX_FIT_WIDTH) {
        const ratio = MAX_FIT_WIDTH / targetWidth;
        targetWidth = MAX_FIT_WIDTH;
        targetHeight = targetHeight * ratio;
      }

      fitToContent(id, Math.round(targetWidth), Math.round(targetHeight), nodeData.onResize);
    }
  }, [id, nodeData.imageWidth, nodeData.imageHeight, nodeData.onResize, fitToContent]);

  const handleResize = useCallback((_: any, params: { width: number }) => {
    handleResizeWithDebounce(id, params.width, 'auto', nodeData.onResize);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  const handleDelete = () => {
    if (nodeData.onDelete) {
      nodeData.onDelete(id);
    } else {
      setNodes((nodes) => nodes.filter((node) => node.id !== id));
    }
  };

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="min-w-[240px]"
      onFitToContent={handleFitToContent}
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={100}
          minHeight={100}
          maxWidth={1000}
          maxHeight={1000}
          keepAspectRatio={!!logoImageUrl}
          onResize={handleResize}
        />
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="logo-output"
        className="w-2 h-2 bg-brand-cyan border-2 border-black node-handle"
      />

      {/* Header */}
      <NodeHeader icon={UploadCloud} title={t('canvasNodes.logoNode.title')} selected={selected} />

      {/* Logo Upload Section */}
      {logoImageUrl ? (
        <div className="relative">
          <div className="relative w-full h-auto min-h-[1210px] bg-neutral-900/50 rounded border-node border-neutral-700/30 overflow-hidden">
            <img
              src={logoImageUrl}
              alt={t('canvasNodes.logoNode.logoAltText')}
              className="w-full h-full object-contain p-2"
            />
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
          <NodeButton onClick={handleLogoUploadClick}>
            <UploadCloud size={14} />
            {t('canvasNodes.logoNode.uploadLogo')}
          </NodeButton>
        </>
      )}

      {!dragging && (
        <NodeActionBar selected={selected} getZoom={getZoom}>
          <ImageNodeActionButtons
            onRemove={handleRemoveLogo}
            showRemove={!!logoImageUrl}
            onDelete={() => setShowDeleteModal(true)}
            showDelete={true}
            translationKeyPrefix="canvasNodes.logoNode"
            t={t}
          />
        </NodeActionBar>
      )}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title={t('canvasNodes.logoNode.deleteTitle') || 'Delete Logo Node'}
        message={t('canvasNodes.logoNode.deleteMessage') || 'Are you sure you want to delete this logo node?'}
        confirmText={t('canvasNodes.logoNode.deleteButton') || 'Delete'}
        cancelText={t('canvasNodes.logoNode.cancelButton') || 'Cancel'}
        variant="danger"
      />
    </NodeContainer>
  );
});

LogoNode.displayName = 'LogoNode';
