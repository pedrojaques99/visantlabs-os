import { useCallback, useRef } from 'react';
import type { Node } from '@xyflow/react';
import type { FlowNodeData, ChatNodeData, StrategyNodeData, PromptNodeData } from '../../types/reactFlow';
import { toast } from 'sonner';
import { sendChatMessage } from '../../services/chatService';
import { getChatMessageCreditsRequired } from '../../utils/creditCalculator';

interface UseChatNodeHandlerParams {
  nodesRef: React.MutableRefObject<Node<FlowNodeData>[]>;
  updateNodeData: <T extends FlowNodeData>(
    nodeId: string,
    newData: Partial<T>,
    nodeType?: string
  ) => void;
  userId?: string;
  saveImmediately?: () => Promise<void>;
  addPromptNode?: (customPosition?: { x: number; y: number }, initialData?: Partial<PromptNodeData>) => string | undefined;
}

export const useCanvasChatHandler = ({
  nodesRef,
  updateNodeData,
  userId,
  saveImmediately,
  addPromptNode,
}: UseChatNodeHandlerParams) => {
  
  const handleChatSendMessage = useCallback(async (
    nodeId: string,
    message: string,
    context: {
      images?: string[];
      text?: string;
      strategyData?: StrategyNodeData['strategyData'];
    }
  ) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'chat') return;
    
    const chatData = node.data as ChatNodeData;
    
    // Validate message
    if (!message || message.trim().length === 0) {
      toast.error('Message cannot be empty', { duration: 3000 });
      return;
    }
    
    // Increment user message count
    const currentMessageCount = (chatData.userMessageCount || 0) + 1;
    
    // Calculate credits required (1 credit every 4 messages)
    const creditsToDeduct = getChatMessageCreditsRequired(currentMessageCount);
    
    // Update node with user message and increment count
    const userMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user' as const,
      content: message.trim(),
      timestamp: Date.now(),
      contextUsed: {
        hasImages: !!(context.images && context.images.length > 0),
        hasStrategyData: !!context.strategyData,
        hasTextContext: !!context.text,
      },
    };
    
    const updatedMessages = [...(chatData.messages || []), userMessage];
    
    // Update node with user message and set loading state
    updateNodeData<ChatNodeData>(nodeId, {
      messages: updatedMessages,
      userMessageCount: currentMessageCount,
      isLoading: true,
    }, 'chat');
    
    // Note: Credit deduction is handled on the backend via the generate endpoint
    // The backend validates credits before processing the request
    
    try {
      // Prepare messages for API (convert to ChatMessage format)
      const apiMessages = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      // Call chat service
      const response = await sendChatMessage(apiMessages, context);
      
      // Add assistant response
      const assistantMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant' as const,
        content: response,
        timestamp: Date.now(),
      };
      
      // Limit history to last 20 messages to prevent payload issues
      const allMessages = [...updatedMessages, assistantMessage];
      const limitedMessages = allMessages.slice(-20);
      
      // Update node with response
      updateNodeData<ChatNodeData>(nodeId, {
        messages: limitedMessages,
        userMessageCount: currentMessageCount,
        isLoading: false,
      }, 'chat');
      
      if (saveImmediately) {
        setTimeout(() => saveImmediately(), 100);
      }
    } catch (error: any) {
      console.error('[ChatHandler] Error sending message:', error);
      
      // On error, remove user message and reset count
      updateNodeData<ChatNodeData>(nodeId, {
        messages: chatData.messages, // Revert to previous messages
        userMessageCount: chatData.userMessageCount || 0, // Revert count
        isLoading: false,
      }, 'chat');
      
      toast.error(error?.message || 'Failed to send message. Please try again.', { duration: 5000 });
    }
  }, [nodesRef, updateNodeData, userId, saveImmediately]);
  
  const handleChatUpdateData = useCallback((nodeId: string, newData: Partial<ChatNodeData>) => {
    updateNodeData<ChatNodeData>(nodeId, newData, 'chat');
  }, [updateNodeData]);
  
  const handleChatClearHistory = useCallback((nodeId: string) => {
    updateNodeData<ChatNodeData>(nodeId, {
      messages: [],
      userMessageCount: 0,
    }, 'chat');
    toast.success('Chat history cleared', { duration: 2000 });
  }, [updateNodeData]);

  const handleChatAddPromptNode = useCallback((nodeId: string, prompt: string) => {
    if (!addPromptNode) {
      toast.error('Unable to create prompt node');
      return;
    }

    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;

    // Create prompt node to the right of the chat node
    const position = {
      x: window.innerWidth / 2 + 300,
      y: window.innerHeight / 2,
    };

    // If we have access to the real position in the flow, we'd use it, 
    // but addPromptNode handles screen to flow conversion if passed screen coords.
    // By passing undefined customPosition, it defaults to center of screen.
    // For now let's use the default center and pre-fill the prompt.
    
    addPromptNode(undefined, { prompt });
    toast.success('Prompt node created!', { duration: 2000 });
  }, [addPromptNode, nodesRef]);
  
  return {
    handleChatSendMessage,
    handleChatUpdateData,
    handleChatClearHistory,
    handleChatAddPromptNode,
  };
};


