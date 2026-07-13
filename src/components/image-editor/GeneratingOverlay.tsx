import React from 'react';
import { useImageEditorStore } from '@/stores/imageEditorStore';
import { GeneratingImageCard } from '@/components/ui/GeneratingImageCard';
import { EDITOR_STATUS_MESSAGES } from '@/constants/imageEditorTokens';

export const GeneratingOverlay: React.FC = () => {
  const isGenerating = useImageEditorStore((s) => s.isGenerating);

  if (!isGenerating) return null;

  const handleCancel = () => {
    useImageEditorStore.getState().setGenerating(false);
  };

  return (
    <GeneratingImageCard
      isLoading
      variant="overlay"
      steps={EDITOR_STATUS_MESSAGES}
      onCancel={handleCancel}
    />
  );
};
