import { useEffect, useCallback } from 'react';
import { usePluginStore } from '../store';
import { apiUrl } from '../config';
import type { UIMessage, PluginMessage } from '@/lib/figma-types';
import type { ColorEntry } from '../store/types';

// Module-level refcount — ensures exactly ONE window listener regardless of
// how many components call useFigmaMessages(). Prevents duplicate handling
// (e.g. N chat bubbles per API response when N hooks are mounted).
let listenerRefCount = 0;
let activeListener: ((event: MessageEvent) => void) | null = null;

export function useFigmaMessages() {
  const send = useCallback((msg: UIMessage) => {
    parent.postMessage({ pluginMessage: msg }, 'https://www.figma.com');
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // The PluginMessage discriminated union only covers a subset of the
      // ~45 message types actually exchanged at runtime. Treat the payload as
      // loose inside the switch — per-case reads are explicit about their fields.
      const raw = event.data?.pluginMessage as PluginMessage | undefined;
      if (!raw?.type) return;
      const msg = raw as any;

      const storeState = usePluginStore.getState();
      switch (msg.type as string) {
        // ═══ Context & Selection ═══
        case 'CONTEXT_UPDATED':
        case 'ENRICHED_CONTEXT': {
          const sel = (msg as any).selectionDetails ?? (msg as any).selection;
          if (sel) {
            storeState.updateSelection(sel);
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
            // Show SmartScan modal with categorized results
            usePluginStore.setState({
              pendingAttachments: msg.items,
              showSmartScanModal: true,
              smartScanResults: msg.items
            });
            storeState.showToast(`Found ${msg.items.length} elements`, 'success');
          } else {
            storeState.showToast('No elements found', 'warning');
          }
          break;
        }

        // ═══ Operations & Results ═══
        case 'OPERATIONS_RESULT':
        case 'OPERATIONS_DONE': {
          const ops = msg.operations;
          const content =
            msg.message ||
            msg.summary ||
            (typeof msg.count === 'number' ? `${msg.count} operations applied` : 'Operations applied successfully');
          storeState.addChatMessage({
            id: `msg-${Date.now()}`,
            role: 'assistant' as const,
            content,
            timestamp: Date.now(),
            operations: ops
          });
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
          const token = msg.authToken ?? msg.token;
          if (token) storeState.setAuthToken(token);
          if (msg.authEmail) storeState.setAuthEmail(msg.authEmail);
          break;
        }

        case 'API_KEY_SAVED': {
          storeState.showToast('API key saved', 'success');
          break;
        }
        case 'API_KEY_LOADED': {
          if (msg.key) storeState.setApiKey(msg.key);
          break;
        }

        case 'ANTHROPIC_KEY_SAVED': {
          storeState.showToast('Anthropic key saved', 'success');
          break;
        }
        case 'ANTHROPIC_KEY_LOADED': {
          if (msg.key) storeState.setAnthropicApiKey(msg.key);
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
          parent.postMessage({ pluginMessage: { type: 'GET_GUIDELINES' } }, 'https://www.figma.com');
          break;
        }

        case 'LOCAL_BRAND_LOADED': {
          const brand = msg.brand ?? msg.config;
          if (brand) {
            const colorsMap = new Map<string, ColorEntry>();
            const raw = brand.colors;
            if (Array.isArray(raw)) {
              raw.forEach((c: any, i: number) => {
                if (!c?.hex) return;
                const role = c.role || c.name || `color-${i}`;
                colorsMap.set(role, { role, hex: c.hex, name: c.name });
              });
            } else if (raw && typeof raw === 'object') {
              Object.entries(raw).forEach(([role, v]: [string, any]) => {
                const hex = typeof v === 'string' ? v : v?.hex;
                if (hex) colorsMap.set(role, { role, hex, name: v?.name });
              });
            }
            usePluginStore.setState({
              logos: brand.logos || [],
              selectedColors: colorsMap
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

        // SELECTION_LOGO_RESULT is consumed directly by useLogoUpload.
        // COMPONENT_CAPTURED has no active consumer — kept as no-op for sandbox safety.
        case 'COMPONENT_CAPTURED':
        case 'SELECTION_LOGO_RESULT':
          break;

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
            const current = usePluginStore.getState();
            usePluginStore.setState({ designTokens: { ...current.designTokens, variables: msg.variables } });
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
            storeState.setUserInfo(msg.user);
          }
          break;
        }

        // ═══ Data Export/Import ═══
        case 'EXPORT_NODE_IMAGE_RESULT': {
          if (msg.error) {
            storeState.showToast(`Export failed: ${msg.error}`, 'error');
          } else if (msg.data) {
            storeState.setExportedImage(msg.data);
            storeState.showToast('Image exported', 'success');
          }
          break;
        }

        case 'SELECTION_FONT_RESULT': {
          if (msg.font) {
            usePluginStore.setState({ selectedFont: msg.font });
            storeState.showToast(`Selected font: ${msg.font.family}`, 'success');
          }
          break;
        }

        case 'ELEMENTS_FOR_MENTIONS': {
          if (msg.elements) {
            storeState.setMentionElements(msg.elements);
          }
          break;
        }

        case 'EXTRACT_FOR_SYNC_RESULT': {
          if (msg.data) {
            storeState.setExtractSyncData(msg.data);
            storeState.showToast('Figma data extracted', 'success');
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
          if (msg.report) {
            usePluginStore.setState({ brandLintReport: msg.report });
            const issueCount = msg.report.issues?.length || 0;
            storeState.showToast(`Brand lint: ${issueCount} issues found`, issueCount > 0 ? 'warning' : 'success');
          }
          break;
        }

        case 'BRAND_APPLY_DEBUG': {
          if (msg.debug) {
            console.log('Brand Apply Debug:', msg.debug);
            storeState.showToast('Brand applied', 'success');
          }
          break;
        }

        // ═══ Screenshots & Export ═══
        case 'SCREENSHOT_RESULT': {
          const payload = msg.data ?? (msg.base64 ? { base64: msg.base64, nodeId: msg.nodeId } : null);
          if (payload) {
            storeState.setExportedImage({ type: 'screenshot', ...payload });
          }
          break;
        }

        case 'ILLUSTRATOR_CODE_READY': {
          if (msg.code) {
            // Copy code to clipboard
            navigator.clipboard.writeText(msg.code).then(() => {
              storeState.showToast('Illustrator code copied to clipboard!', 'success');
            }).catch(() => {
              storeState.showToast('Failed to copy code', 'error');
            });
          }
          break;
        }

        // ═══ Design Context (consumed by operation engine, stored for debugging) ═══
        case 'DESIGN_CONTEXT_RESULT':
        case 'SEARCH_DS_RESULT':
        case 'CODE_CONNECT_RESULT': {
          break;
        }

        // ═══ API Calls ═══
        case 'CALL_API': {
          // Call backend API with context from sandbox
          const context = msg.context || msg.payload;
          if (!context) break;

          try {
            storeState.setIsGenerating(true);
            storeState.showToast('Calling Gemini...', 'info');

            const response = await fetch(apiUrl('/plugin'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(storeState.authToken ? { Authorization: `Bearer ${storeState.authToken}` } : {})
              },
              body: JSON.stringify(context)
            });

            if (!response.ok) {
              const error = await response.json().catch(() => ({ error: response.statusText }));
              throw new Error(error.error || `API error: ${response.status}`);
            }

            const result = await response.json();

            // Backend returns { operations, message, ... }. The assistant's
            // spoken text lives in ops where type === 'MESSAGE'; the rest are
            // design operations the sandbox will apply.
            const ops: any[] = Array.isArray(result.operations) ? result.operations : [];
            const messageOps = ops.filter((o) => o?.type === 'MESSAGE' && o.content);
            const designOps = ops.filter((o) => o?.type !== 'MESSAGE');
            const spokenText = messageOps.map((o) => String(o.content)).join('\n\n');
            const content =
              spokenText ||
              result.text ||
              result.response ||
              result.message ||
              (designOps.length > 0 ? `Generated ${designOps.length} operation(s)` : 'Done');

            storeState.addChatMessage({
              id: `msg-${Date.now()}`,
              role: 'assistant' as const,
              content,
              timestamp: Date.now(),
              operations: designOps
            });

            if (designOps.length > 0) {
              // Send ops back to sandbox for execution via Figma API
              parent.postMessage(
                { pluginMessage: { type: 'APPLY_OPERATIONS_FROM_API', operations: designOps } },
                'https://www.figma.com'
              );
              storeState.showToast(`Applying ${designOps.length} operation(s)…`, 'info');
            }
          } catch (err) {
            console.error('API call failed:', err);
            storeState.showToast(`API error: ${(err as Error).message}`, 'error');
          } finally {
            storeState.setIsGenerating(false);
          }
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

    listenerRefCount++;
    if (!activeListener) {
      activeListener = handleMessage;
      window.addEventListener('message', handleMessage);
    }

    return () => {
      listenerRefCount--;
      if (listenerRefCount <= 0 && activeListener) {
        window.removeEventListener('message', activeListener);
        activeListener = null;
        listenerRefCount = 0;
      }
    };
  }, []);

  return { send };
}
