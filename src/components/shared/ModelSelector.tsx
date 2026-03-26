import React, { useMemo } from 'react';
import { CHAT_MODELS, MODEL_CONFIG } from '../../constants/geminiModels';
import { Select } from '@/components/ui/select';
import { cn } from '../../lib/utils';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  className?: string;
  type?: 'chat' | 'image';
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  className,
  type = 'chat'
}) => {
  const options = useMemo(() => {
    return CHAT_MODELS.map(modelId => {
      const config = MODEL_CONFIG[modelId];
      return {
        value: modelId,
        label: config?.label || modelId,
        // Removed emojis to maintain a subtle, professional UI
      };
    });
  }, []);

  return (
    <div className={cn("min-w-[140px]", className)}>
      <Select
        variant="node"
        options={options}
        value={selectedModel}
        onChange={onModelChange}
        className={cn(
          "!bg-transparent border-white/5 hover:border-white/10 !px-2 !py-0.5 h-auto",
          "text-[10px] font-mono tracking-wider opacity-60 hover:opacity-100 transition-opacity",
          className
        )}
      />
    </div>
  );
};
