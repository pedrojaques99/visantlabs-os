import { useEffect, useCallback, useRef } from 'react';
import { usePluginStore } from '../store';
import type { UIMessage, PluginMessage } from '@/lib/figma-types';

export function useFigmaMessages() {
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const store = usePluginStore();

  const send = useCallback((msg: UIMessage) => {
    parent.postMessage({ pluginMessage: msg }, 'https://www.figma.com');
  }, []);

  useEffect(() => {
    // Get current store state to use in handler
    const currentStore = usePluginStore.getState();

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined;
      if (!msg?.type) return;

      // Dispatch message to store based on type
      const storeState = usePluginStore.getState();
      switch (msg.type) {
        // ═══ Context & Selection ═══
        case 'CONTEXT_UPDATED':
        case 'ENRICHED_CONTEXT': {
          if (msg.selection) {
            storeState.updateSelection(msg.selection);
          }
          break;
        }

        case 'SELECTION_CHANGED': {
          if (msg.nodes) {
            storeState.updateSelection(msg.nodes);
          }
          break;
        }

        case 'SMART_SCAN_RESULT': {
          if (msg.items) {
            usePluginStore.setState({ pendingAttachments: msg.items });
          }
          break;
        }

        // ═══ Operations & Results ═══
        case 'OPERATIONS_RESULT':
        case 'OPERATIONS_DONE': {
          if (msg.operations) {
            const chatMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant' as const,
              content: msg.message || 'Operations applied successfully',
              timestamp: Date.now(),
              operations: msg.operations
            };
            storeState.addChatMessage(chatMessage);
          }
          break;
        }

        case 'OPERATION_ACK': {
          // Operation acknowledged by sandbox
          break;
        }

        case 'OPERATION_ERROR': {
          storeState.showToast(`Operation failed: ${msg.error}`, 'error');
          break;
        }

        case 'UNDO_RESULT': {
          if (msg.success) {
            storeState.showToast(msg.message || 'Undo successful', 'success');
          } else {
            storeState.showToast(msg.message || 'Nothing to undo', 'warning');
          }
          break;
        }

        // ═══ Auth & Tokens ═══
        case 'AUTH_UPDATED':
        case 'AUTH_TOKEN_SAVED': {
          if (msg.authToken) {
            storeState.setAuthToken(msg.authToken);
          }
          if (msg.authEmail) {
            storeState.setAuthEmail(msg.authEmail);
          }
          storeState.showToast('Login successful', 'success');
          break;
        }

        case 'AUTH_TOKEN_LOADED': {
          if (msg.authToken) {
            storeState.setAuthToken(msg.authToken);
          }
          if (msg.authEmail) {
            storeState.setAuthEmail(msg.authEmail);
          }
          break;
        }

        case 'API_KEY_SAVED':
        case 'API_KEY_LOADED': {
          storeState.showToast('API key saved', 'success');
          break;
        }

        case 'ANTHROPIC_KEY_SAVED':
        case 'ANTHROPIC_KEY_LOADED': {
          storeState.showToast('Anthropic key saved', 'success');
          break;
        }

        // ═══ Credits ═══
        case 'CREDITS_UPDATED': {
          if (msg.credits) {
            storeState.updateCredits(msg.credits);
          }
          break;
        }

        // ═══ Brand Guidelines ═══
        case 'BRAND_GUIDELINES_LOADED':
        case 'GUIDELINES_LOADED': {
          if (msg.guidelines) {
            usePluginStore.setState({ brandGuideline: msg.guidelines });
          }
          break;
        }

        case 'BRAND_GUIDELINE_SAVED':
        case 'GUIDELINE_SAVED': {
          storeState.showToast('Brand guideline saved', 'success');
          break;
        }

        case 'LOCAL_BRAND_LOADED': {
          if (msg.brand) {
            usePluginStore.setState({
              logos: msg.brand.logos || [],
              selectedColors: new Map(Object.entries(msg.brand.colors || {}))
            });
          }
          break;
        }

        case 'LOCAL_BRAND_SAVED': {
          storeState.showToast('Brand saved locally', 'success');
          break;
        }

        // ═══ Design System ═══
        case 'DESIGN_SYSTEM_LOADED': {
          if (msg.designSystem) {
            usePluginStore.setState({ designSystem: msg.designSystem });
          }
          break;
        }

        case 'DESIGN_SYSTEM_SAVED': {
          storeState.showToast('Design system saved', 'success');
          break;
        }

        // ═══ Components & Library ═══
        case 'COMPONENTS_LOADED':
        case 'AGENT_COMPONENTS_RESULT': {
          if (msg.components) {
            storeState.setAllComponents(msg.components);
          }
          break;
        }

        case 'COMPONENT_THUMBNAIL': {
          if (msg.componentId && msg.thumbnail) {
            usePluginStore.setState(state => ({
              componentThumbs: {
                ...state.componentThumbs,
                [msg.componentId]: msg.thumbnail
              }
            }));
          }
          break;
        }

        case 'COMPONENT_CAPTURED':
        case 'SELECTION_LOGO_RESULT': {
          // Component captured, no action needed
          break;
        }

        // ═══ Variables ═══
        case 'FONT_VARIABLES_LOADED': {
          if (msg.fonts) {
            const current = usePluginStore.getState();
            usePluginStore.setState({ designTokens: { ...current.designTokens, fonts: msg.fonts } });
          }
          break;
        }

        case 'COLOR_VARIABLES_LOADED': {
          if (msg.colors) {
            const current = usePluginStore.getState();
            usePluginStore.setState({ designTokens: { ...current.designTokens, colors: msg.colors } });
          }
          break;
        }

        case 'AVAILABLE_FONTS_LOADED': {
          if (msg.families) {
            const current = usePluginStore.getState();
            usePluginStore.setState({ designTokens: { ...current.designTokens, families: msg.families } });
          }
          break;
        }

        case 'VARIABLE_DEFS_RESULT': {
          if (msg.variables) {

          }
          break;
        }

        // ═══ User & Session ═══
        case 'SESSION_RESTORED': {
          if (msg.sessionId) {
            usePluginStore.setState({ sessionId: msg.sessionId });
          }
          break;
        }

        case 'USER_INFO': {
          if (msg.user) {

          }
          break;
        }

        // ═══ Data Export/Import ═══
        case 'EXPORT_NODE_IMAGE_RESULT': {
          if (msg.error) {
            storeState.showToast(`Export failed: ${msg.error}`, 'error');
          } else {

          }
          break;
        }

        case 'SELECTION_FONT_RESULT': {
          if (msg.font) {

          }
          break;
        }

        case 'ELEMENTS_FOR_MENTIONS': {
          if (msg.elements) {

          }
          break;
        }

        case 'EXTRACT_FOR_SYNC_RESULT': {
          if (msg.data) {

          }
          break;
        }

        case 'EXTRACT_FOR_SYNC_ERROR': {
          storeState.showToast(`Extract failed: ${msg.error}`, 'error');
          break;
        }

        case 'PUSH_TO_FIGMA_RESULT': {
          storeState.showToast('Push to Figma successful', 'success');
          break;
        }

        case 'PUSH_TO_FIGMA_ERROR': {
          storeState.showToast(`Push failed: ${msg.error}`, 'error');
          break;
        }

        // ═══ Brand Intelligence ═══
        case 'BRAND_LINT_REPORT': {

          break;
        }

        case 'BRAND_APPLY_DEBUG': {

          break;
        }

        // ═══ Screenshots & Export ═══
        case 'SCREENSHOT_RESULT': {
          if (msg.data) {

          }
          break;
        }

        case 'ILLUSTRATOR_CODE_READY': {

          break;
        }

        // ═══ Design Context ═══
        case 'DESIGN_CONTEXT_RESULT': {

          break;
        }

        case 'SEARCH_DS_RESULT': {

          break;
        }

        case 'CODE_CONNECT_RESULT': {

          break;
        }

        // ═══ API Calls ═══
        case 'CALL_API': {
          // Gemini API call is being routed - message is relay from server

          break;
        }

        // ═══ Errors ═══
        case 'ERROR': {
          storeState.showToast(msg.message || 'An error occurred', 'error');
          break;
        }

        // ═══ Unknown ═══
        default:
          console.debug('[Plugin] Unhandled message type:', msg.type, msg);
      }
    };

    messageHandlerRef.current = handleMessage;
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      messageHandlerRef.current = null;
    };
  }, []);

  return { send };
}
