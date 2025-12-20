import React, { useState, useRef, useCallback, memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Loader2, UploadCloud, Palette, X, Copy, RefreshCw } from 'lucide-react';
import type { ColorExtractorNodeData } from '../../types/reactFlow';
import { cn } from '../../lib/utils';
import { fileToBase64 } from '../../utils/fileUtils';
import { toast } from 'sonner';
import { normalizeImageToBase64 } from '../../services/reactFlowService';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeLabel } from './shared/node-label';
import { NodeButton } from './shared/node-button';
import { LabeledHandle } from './shared/LabeledHandle';
import { useTranslation } from '../../hooks/useTranslation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ColorExtractorNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const nodeData = data as ColorExtractorNodeData;
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Prioritize connected data over direct uploads
  const connectedImage = nodeData.connectedImage;
  const imageBase64 = connectedImage || nodeData.imageBase64;
  const extractedColors = nodeData.extractedColors || [];
  const isExtracting = nodeData.isExtracting || false;

  // Format image URL - handle both base64 strings and data URLs
  const imageUrl = imageBase64
    ? (imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`)
    : undefined;

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    imageInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nodeData.onUpload) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file', { duration: 3000 });
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds 10MB limit', { duration: 5000 });
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      return;
    }

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }

    try {
      const imageData = await fileToBase64(file);
      nodeData.onUpload(id, imageData.base64);
      toast.success('Image uploaded successfully!', { duration: 2000 });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to process image', { duration: 5000 });
      console.error('Failed to process image:', error);
    }
  };

  const handleExtract = useCallback(async () => {
    if (!nodeData.onExtract || !imageBase64) {
      toast.error('Please upload or connect an image first', { duration: 3000 });
      return;
    }

    // Convert URLs to base64 if necessary
    let imageForExtraction = imageBase64;

    if (imageBase64.startsWith('http://') || imageBase64.startsWith('https://')) {
      try {
        imageForExtraction = await normalizeImageToBase64(imageBase64);
      } catch (error: any) {
        toast.error('Failed to load image', { duration: 3000 });
        console.error('Failed to convert image URL to base64:', error);
        return;
      }
    }

    await nodeData.onExtract(id, imageForExtraction);
  }, [nodeData, id, imageBase64]);

  const handleRemoveImage = () => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, { imageBase64: undefined });
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleCopyColor = useCallback(async (color: string) => {
    try {
      await navigator.clipboard.writeText(color);
      toast.success(`Copied ${color} to clipboard`, { duration: 2000 });
    } catch (error) {
      console.error('Failed to copy color:', error);
      toast.error('Failed to copy color', { duration: 3000 });
    }
  }, []);

  const handleColorChange = useCallback((index: number, newColor: string) => {
    if (!nodeData.onUpdateData || !extractedColors) return;

    const updatedColors = [...extractedColors];
    updatedColors[index] = newColor.toUpperCase();
    nodeData.onUpdateData(id, { extractedColors: updatedColors });
  }, [nodeData, id, extractedColors]);

  const canExtract = !!(imageBase64 && !isExtracting);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="p-5 min-w-[320px] max-w-[400px]"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {/* Input Handle - accepts image connections from ImageNode and OutputNode */}
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="image-input"
        label="Image"
        handleType="image"
        style={{ top: '90px' }}
      />

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="node-handle"
      />

      {/* Header */}
      <NodeHeader icon={Palette} title="Color Extractor" />

      {/* Image Upload Section */}
      <div className="mb-4">
        <NodeLabel>
          Image {connectedImage && <span className="text-[10px] text-zinc-500">(connected)</span>}
        </NodeLabel>
        {imageUrl ? (
          <div className="relative group/image">
            <div className="relative w-full h-24 bg-zinc-900/50 rounded border border-zinc-700/30 overflow-hidden">
              <img
                src={imageUrl}
                alt="Source image"
                className="w-full h-full object-contain p-2"
              />
            </div>
            {!connectedImage && (
              <button
                onClick={handleRemoveImage}
                className="absolute top-1 right-1 p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded opacity-0 group-hover/image:opacity-100 transition-opacity"
                title="Remove image"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ) : (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <NodeButton onClick={handleUploadClick}>
              <UploadCloud size={14} />
              Upload Image
            </NodeButton>
          </>
        )}
      </div>

      {/* Extract Button */}
      <NodeButton
        onClick={handleExtract}
        disabled={!canExtract}
        variant="primary"
        className="mb-4"
      >
        {isExtracting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Extracting Colors...
          </>
        ) : (
          <>
            <Palette size={14} />
            Extract Colors
          </>
        )}
      </NodeButton>

      {/* Extracted Colors Display */}
      {extractedColors.length > 0 && (
        <div className="border-t border-zinc-700/30 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <NodeLabel className="mb-0">Extracted Colors ({extractedColors.length})</NodeLabel>
            <NodeButton
              onClick={handleExtract}
              disabled={!canExtract}
              variant="default"
              className="w-auto px-3 py-2 mb-0"
            >
              <RefreshCw size={12} />
              Regenerate
            </NodeButton>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {extractedColors.map((color, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-zinc-900/50 rounded border border-zinc-700/30 hover:border-[#52ddeb]/50 transition-colors group/color"
              >
                <div
                  className="w-8 h-8 rounded border border-zinc-700/50 flex-shrink-0"
                  style={{ backgroundColor: color }}
                  title={color}
                />
                <span className="text-xs font-mono text-zinc-400 flex-1 truncate" title={color}>
                  {color}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleCopyColor(color)}
                    className="p-1 hover:bg-zinc-700/50 rounded transition-colors opacity-0 group-hover/color:opacity-100"
                    title="Copy color"
                  >
                    <Copy size={12} className="text-zinc-400 hover:text-[#52ddeb]" />
                  </button>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange(index, e.target.value)}
                    className="w-6 h-6 rounded border border-zinc-700/50 cursor-pointer opacity-0 group-hover/color:opacity-100 transition-opacity"
                    title="Edit color"
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </NodeContainer>
  );
});

ColorExtractorNode.displayName = 'ColorExtractorNode';





