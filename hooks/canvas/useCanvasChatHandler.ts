import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { 
  FlowNodeData, 
  ChatNodeData, 
  StrategyNodeData, 
  PromptNodeData,
  MockupNodeData,
  TextNodeData,
  FlowNodeType
} from '../../types/reactFlow';
import { toast } from 'sonner';
import { sendChatMessage } from '../../services/chatService';
import { getChatMessageCreditsRequired } from '../../utils/creditCalculator';

import type { ImageNodeData } from '../../types/reactFlow';

// Node creation functions type
type NodeCreationFunctions = {
  addPromptNode?: (customPosition?: { x: number; y: number }, initialData?: Partial<PromptNodeData>) => string | undefined;
  addMockupNode?: (customPosition?: { x: number; y: number }) => string | undefined;
  addStrategyNode?: (customPosition?: { x: number; y: number }) => string | undefined;
  addTextNode?: (customPosition?: { x: number; y: number }, initialText?: string) => string | undefined;
  addMergeNode?: (customPosition?: { x: number; y: number }) => string | undefined;
  addEditNode?: (customPosition?: { x: number; y: number }) => string | undefined;
  addImageNode?: (customPosition?: { x: number; y: number }) => string | undefined;
  addImageNodeWithMedia?: (customPosition?: { x: number; y: number }, imageBase64?: string, mimeType?: string) => string | undefined;
};

interface UseChatNodeHandlerParams {
  nodesRef: React.MutableRefObject<Node<FlowNodeData>[]>;
  edgesRef?: React.MutableRefObject<Edge[]>;
  updateNodeData: <T extends FlowNodeData>(
    nodeId: string,
    newData: Partial<T>,
    nodeType?: string
  ) => void;
  userId?: string;
  saveImmediately?: () => Promise<void>;
  nodeCreators?: NodeCreationFunctions;
  setEdges?: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  // Legacy support
  addPromptNode?: (customPosition?: { x: number; y: number }, initialData?: Partial<PromptNodeData>) => string | undefined;
}

export const useCanvasChatHandler = ({
  nodesRef,
  edgesRef,
  updateNodeData,
  userId,
  saveImmediately,
  nodeCreators,
  setEdges,
  addPromptNode,
}: UseChatNodeHandlerParams) => {
  
  // Merge legacy addPromptNode with nodeCreators
  const creators: NodeCreationFunctions = {
    ...nodeCreators,
    addPromptNode: nodeCreators?.addPromptNode || addPromptNode,
  };
  
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
      
      // Call chat service with custom system prompt if available
      const response = await sendChatMessage(apiMessages, context, undefined, chatData.systemPrompt);
      
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
    if (!creators.addPromptNode) {
      toast.error('Unable to create prompt node');
      return;
    }

    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;

    creators.addPromptNode(undefined, { prompt });
    toast.success('Prompt node created!', { duration: 2000 });
  }, [creators, nodesRef]);

  /**
   * Generic handler to create any type of node from the chat
   * Supports: prompt, mockup, strategy, text, merge, edit, image
   */
  const handleChatCreateNode = useCallback((
    chatNodeId: string,
    nodeType: FlowNodeType,
    initialData?: Partial<FlowNodeData>,
    connectToChat?: boolean
  ): string | undefined => {
    const chatNode = nodesRef.current.find(n => n.id === chatNodeId);
    if (!chatNode) {
      toast.error('Chat node not found');
      return undefined;
    }

    let newNodeId: string | undefined;
    const nodeTypeLabels: Record<string, string> = {
      prompt: 'Prompt',
      mockup: 'Mockup',
      strategy: 'Strategy',
      text: 'Text',
      merge: 'Merge',
      edit: 'Edit',
      image: 'Image',
    };

    switch (nodeType) {
      case 'prompt':
        if (creators.addPromptNode) {
          const promptData = initialData as Partial<PromptNodeData> | undefined;
          newNodeId = creators.addPromptNode(undefined, promptData);
        }
        break;
      case 'mockup':
        if (creators.addMockupNode) {
          newNodeId = creators.addMockupNode(undefined);
          // Update mockup data after creation if initialData provided
          if (newNodeId && initialData) {
            setTimeout(() => {
              updateNodeData<MockupNodeData>(newNodeId!, initialData as Partial<MockupNodeData>, 'mockup');
            }, 50);
          }
        }
        break;
      case 'strategy':
        if (creators.addStrategyNode) {
          newNodeId = creators.addStrategyNode(undefined);
        }
        break;
      case 'text':
        if (creators.addTextNode) {
          const textData = initialData as Partial<TextNodeData> | undefined;
          newNodeId = creators.addTextNode(undefined, textData?.text);
        }
        break;
      case 'merge':
        if (creators.addMergeNode) {
          newNodeId = creators.addMergeNode(undefined);
        }
        break;
      case 'edit':
        if (creators.addEditNode) {
          newNodeId = creators.addEditNode(undefined);
        }
        break;
      case 'image':
        if (creators.addImageNode) {
          newNodeId = creators.addImageNode(undefined);
        }
        break;
      default:
        toast.error(`Node type "${nodeType}" not supported`);
        return undefined;
    }

    if (newNodeId) {
      const label = nodeTypeLabels[nodeType] || nodeType;
      toast.success(`${label} node created!`, { duration: 2000 });
      
      // Auto-connect from chat node output to the new node if requested
      if (connectToChat && setEdges && edgesRef) {
        setTimeout(() => {
          // Determine the correct target handle based on node type
          // Each node type has different input handles
          // null = use default (single input), undefined = skip connection
          const targetHandleMap: Record<string, string | null | undefined> = {
            prompt: 'input-1',      // PromptNode has multiple image inputs (input-1 to input-4)
            mockup: null,           // MockupNode has a single default image input
            strategy: undefined,    // StrategyNode doesn't need output connections
            text: undefined,        // TextNode doesn't need output connections
            merge: 'input-1',       // MergeNode has multiple inputs
            edit: null,             // EditNode has single input
            image: undefined,       // ImageNode doesn't need input connections from chat output
          };
          
          const targetHandle = targetHandleMap[nodeType];
          
          // Only create edge if the target node type supports connections
          if (targetHandle !== undefined) {
            const newEdge: Edge = {
              id: `edge-${chatNodeId}-to-${newNodeId}`,
              source: chatNodeId,
              target: newNodeId!,
              sourceHandle: null,  // ChatNode's default output (bottom handle)
              targetHandle: targetHandle,
            };
            setEdges((eds: Edge[]) => [...eds, newEdge]);
          }
        }, 100);
      }
    } else {
      toast.error(`Unable to create ${nodeType} node. Feature may not be available.`);
    }

    return newNodeId;
  }, [nodesRef, creators, updateNodeData, setEdges, edgesRef]);

  /**
   * Handler to edit a connected node's data
   */
  const handleChatEditConnectedNode = useCallback((
    targetNodeId: string,
    updates: Partial<FlowNodeData>
  ): boolean => {
    const targetNode = nodesRef.current.find(n => n.id === targetNodeId);
    if (!targetNode) {
      toast.error('Target node not found');
      return false;
    }

    const nodeType = targetNode.type;
    if (!nodeType) {
      toast.error('Unknown node type');
      return false;
    }

    try {
      updateNodeData(targetNodeId, updates, nodeType);
      toast.success('Node updated!', { duration: 2000 });
      
      if (saveImmediately) {
        setTimeout(() => saveImmediately(), 100);
      }
      return true;
    } catch (error) {
      console.error('[ChatHandler] Error editing node:', error);
      toast.error('Failed to update node');
      return false;
    }
  }, [nodesRef, updateNodeData, saveImmediately]);

  /**
   * Get IDs of nodes connected to the chat node
   */
  const getConnectedNodeIds = useCallback((chatNodeId: string): string[] => {
    if (!edgesRef) return [];
    
    const connectedIds: string[] = [];
    edgesRef.current.forEach(edge => {
      if (edge.source === chatNodeId && edge.target) {
        connectedIds.push(edge.target);
      }
      if (edge.target === chatNodeId && edge.source) {
        connectedIds.push(edge.source);
      }
    });
    
    return [...new Set(connectedIds)];
  }, [edgesRef]);

  /**
   * Handler to attach media (create ImageNode with uploaded image)
   */
  const handleChatAttachMedia = useCallback((
    chatNodeId: string,
    imageBase64: string,
    mimeType: string
  ): string | undefined => {
    const chatNode = nodesRef.current.find(n => n.id === chatNodeId);
    if (!chatNode) {
      toast.error('Chat node not found');
      return undefined;
    }

    // Use dedicated function if available
    if (creators.addImageNodeWithMedia) {
      const newNodeId = creators.addImageNodeWithMedia(undefined, imageBase64, mimeType);
      if (newNodeId) {
        // Connect image to chat node's input handle
        if (setEdges && edgesRef) {
          setTimeout(() => {
            // Find the first available input handle
            const existingEdges = edgesRef.current.filter(e => e.target === chatNodeId);
            const usedHandles = existingEdges.map(e => e.targetHandle).filter(Boolean);
            const availableHandles = ['input-1', 'input-2', 'input-3', 'input-4'];
            const targetHandle = availableHandles.find(h => !usedHandles.includes(h));
            
            if (targetHandle) {
              const newEdge: Edge = {
                id: `edge-${newNodeId}-${chatNodeId}`,
                source: newNodeId!,
                target: chatNodeId,
                sourceHandle: null,
                targetHandle: targetHandle,
              };
              setEdges((eds: Edge[]) => [...eds, newEdge]);
            }
          }, 100);
        }
        return newNodeId;
      }
    }
    
    // Fallback to regular addImageNode and update data
    if (creators.addImageNode) {
      const newNodeId = creators.addImageNode(undefined);
      if (newNodeId) {
        // Update the node with the image data after creation
        setTimeout(() => {
          updateNodeData<ImageNodeData>(newNodeId!, {
            mockup: {
              _id: '',
              imageBase64: imageBase64,
              mimeType: mimeType,
            } as any,
          }, 'image');
          
          // Connect to chat node
          if (setEdges && edgesRef) {
            const existingEdges = edgesRef.current.filter(e => e.target === chatNodeId);
            const usedHandles = existingEdges.map(e => e.targetHandle).filter(Boolean);
            const availableHandles = ['input-1', 'input-2', 'input-3', 'input-4'];
            const targetHandle = availableHandles.find(h => !usedHandles.includes(h));
            
            if (targetHandle) {
              const newEdge: Edge = {
                id: `edge-${newNodeId}-${chatNodeId}`,
                source: newNodeId!,
                target: chatNodeId,
                sourceHandle: null,
                targetHandle: targetHandle,
              };
              setEdges((eds: Edge[]) => [...eds, newEdge]);
            }
          }
        }, 50);
        return newNodeId;
      }
    }

    toast.error('Unable to create image node. Feature may not be available.');
    return undefined;
  }, [nodesRef, creators, updateNodeData, setEdges, edgesRef]);
  
  return {
    handleChatSendMessage,
    handleChatUpdateData,
    handleChatClearHistory,
    handleChatAddPromptNode,
    handleChatCreateNode,
    handleChatEditConnectedNode,
    getConnectedNodeIds,
    handleChatAttachMedia,
  };
};


