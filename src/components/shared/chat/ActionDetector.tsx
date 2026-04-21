import React from 'react';
import { Diamond, Layers, Target, FileText, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { DetectedAction } from '@/services/chatService';
import { FlowNodeType } from '@/types/reactFlow';

interface ActionDetectorProps {
  actions: DetectedAction[];
  onAddPrompt?: (nodeId: string, prompt: string) => void;
  onCreateNode?: (chatNodeId: string, nodeType: FlowNodeType, initialData?: any, connectToChat?: boolean) => string | undefined;
  nodeId: string;
  t: any;
}

const getActionIcon = (type: DetectedAction['type']) => {
  switch (type) {
    case 'prompt': return <Diamond size={10} />;
    case 'mockup': return <Layers size={10} />;
    case 'strategy': return <Target size={10} />;
    case 'text': return <FileText size={10} />;
    default: return <Plus size={10} />;
  }
};

const getActionColor = (type: DetectedAction['type']) => {
  switch (type) {
    case 'prompt': return 'text-purple-400 border-purple-400/30 bg-purple-400/10 hover:bg-purple-400/20';
    case 'mockup': return 'text-brand-cyan border-brand-cyan/30 bg-brand-cyan/10 hover:bg-brand-cyan/20';
    case 'strategy': return 'text-amber-400 border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20';
    case 'text': return 'text-green-400 border-green-400/30 bg-green-400/10 hover:bg-green-400/20';
    default: return 'text-neutral-400 border-neutral-400/30 bg-neutral-400/10 hover:bg-neutral-400/20';
  }
};

export const ActionDetector: React.FC<ActionDetectorProps> = ({
  actions,
  onAddPrompt,
  onCreateNode,
  nodeId,
  t
}) => {
  if (!actions || actions.length === 0) return null;

  const handleActionClick = (action: DetectedAction) => {
    if (action.type === 'prompt' && onAddPrompt) {
      onAddPrompt(nodeId, action.fullPrompt);
    } else if (onCreateNode) {
      const initialData = action.type === 'prompt'
        ? { prompt: action.fullPrompt }
        : action.type === 'text'
          ? { text: action.fullPrompt }
          : undefined;
      onCreateNode(nodeId, action.type as any, initialData, true);
    }
  };

  return (
    <div className="mt-4 pt-3 border-t border-white/5 space-y-2.5 min-w-0">
      <MicroTitle className="text-[10px] text-brand-cyan/80 flex items-center gap-1.5 mb-2 min-w-0 uppercase tracking-wider">
        <Diamond size={11} className="text-brand-cyan shrink-0" />
        <span className="truncate">
          {t('canvasNodes.chatNode.detectedActions') || 'Ações Sugeridas'}
        </span>
      </MicroTitle>
      <div className="flex flex-wrap gap-2 min-w-0">
        {actions.map((action, i) => (
          <Button
            key={i}
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              handleActionClick(action);
            }}
            className={cn(
              "flex items-center gap-1.5 border rounded-md transition-all text-[10px] h-7 px-2",
              getActionColor(action.type)
            )}
            title={action.description}
          >
            {getActionIcon(action.type)}
            <span className="max-w-[150px] truncate font-medium">{action.title}</span>
            <Plus size={8} className="opacity-50" />
          </Button>
        ))}
      </div>
    </div>
  );
};
