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
          const history = usePluginStore.getState().chatHistory;
          const lastMsg = history[history.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg.operations && lastMsg.operations.length > 0) {
            usePluginStore.setState((s) => {
              const target = s.chatHistory[s.chatHistory.length - 1];
              if (target) {
                target.summaryItems = msg.summaryItems;
              }
            });
          } else {
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
              operations: ops,
              summaryItems: msg.summaryItems
            });
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

        case 'BRAND_GUIDELINE_LOADED': {
          // Persisted brand from pluginData — auto-load on startup
          if (msg.selectedId && msg.guideline) {
            try {
              const parsed = typeof msg.guideline === 'string' ? JSON.parse(msg.guideline) : msg.guideline;
              if (parsed) {
                usePluginStore.setState({ brandGuideline: parsed, linkedGuideline: msg.selectedId });
              }
            } catch {}
          } else if (msg.selectedId && msg.autoLoad) {
            // Have ID but no cache — fetch from server
            usePluginStore.setState({ linkedGuideline: msg.selectedId });
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
            usePluginStore.setState(state => {
              const thumbs: Record<string, string> = { ...state.componentThumbs, [msg.componentId]: msg.thumbnail };
              const keys = Object.keys(thumbs);
              if (keys.length > 50) {
                for (const k of keys.slice(0, keys.length - 50)) delete thumbs[k];
              }
              return { componentThumbs: thumbs };
            });
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
          const flat = [
            ...(msg.frames || []).map((e: any) => ({ ...e, type: 'frame' })),
            ...(msg.components || []).map((e: any) => ({ ...e, type: 'component' })),
            ...(msg.layers || []).map((e: any) => ({ ...e, type: 'layer' })),
            ...(msg.variables || []).map((e: any) => ({ ...e, type: 'variable' })),
          ];
          storeState.setMentionElements(flat);
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
            console.debug('Brand Apply Debug:', msg.debug);
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

            // Try SSE streaming endpoint first
            const useStream = true;
            let streamSuccess = false;

            if (useStream) {
              try {
                const streamResponse = await fetch(apiUrl('/plugin/stream'), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(storeState.authToken ? { Authorization: `Bearer ${storeState.authToken}` } : {}),
                  },
                  body: JSON.stringify(context),
                });

                if (streamResponse.ok && streamResponse.body) {
                  streamSuccess = true;
                  const reader = streamResponse.body.getReader();
                  const decoder = new TextDecoder();
                  let buffer = '';
                  const assistantMsgId = `msg-${Date.now()}`;
                  const streamToolCalls: any[] = [];
                  let streamOps: any[] = [];
                  let streamMessage = '';
                  let messageAdded = false;

                  const updateAssistantMessage = (content: string, ops?: any[], tcs?: any[]) => {
                    if (!messageAdded) {
                      storeState.addChatMessage({
                        id: assistantMsgId,
                        role: 'assistant' as const,
                        content: content || 'Processing...',
                        timestamp: Date.now(),
                        toolCalls: tcs && tcs.length > 0 ? tcs : undefined,
                      });
                      messageAdded = true;
                    } else {
                      usePluginStore.setState((s) => {
                        const target = s.chatHistory.find((m) => m.id === assistantMsgId);
                        if (target) {
                          if (content) target.content = content;
                          if (ops && ops.length > 0) target.operations = ops;
                          if (tcs && tcs.length > 0) target.toolCalls = [...tcs];
                        }
                      });
                    }
                  };

                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    let currentEvent = '';
                    for (const line of lines) {
                      if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                      } else if (line.startsWith('data: ')) {
                        try {
                          const data = JSON.parse(line.slice(6));
                          switch (currentEvent || 'message') {
                            case 'thinking':
                              usePluginStore.getState().setGeneratingStatus(data.message || 'Thinking...');
                              break;
                            case 'tool_start':
                              streamToolCalls.push({
                                id: data.id,
                                name: data.name,
                                status: 'running' as const,
                                args: data.args,
                                startedAt: new Date().toISOString(),
                              });
                              updateAssistantMessage(`Using ${data.name}...`, undefined, streamToolCalls);
                              break;
                            case 'tool_end': {
                              const tc = streamToolCalls.find((t) => t.id === data.id);
                              if (tc) {
                                tc.status = data.error ? 'error' : 'done';
                                tc.endedAt = new Date().toISOString();
                                if (data.error) tc.summary = data.error;
                              }
                              updateAssistantMessage('', undefined, streamToolCalls);
                              break;
                            }
                            case 'operations':
                              streamOps = Array.isArray(data) ? data : [];
                              break;
                            case 'done': {
                              const finalOps: any[] = data.operations || streamOps;
                              const messageOps = finalOps.filter((o: any) => o?.type === 'MESSAGE' && o.content);
                              const designOps = finalOps.filter((o: any) => o?.type !== 'MESSAGE' && o?.type !== 'REQUEST_SCAN');
                              const spokenText = messageOps.map((o: any) => String(o.content)).join('\n\n');
                              streamMessage = spokenText || data.message || (designOps.length > 0 ? `Generated ${designOps.length} operation(s)` : 'Done');

                              const allToolCalls = data.toolCalls || streamToolCalls;
                              updateAssistantMessage(streamMessage, designOps, allToolCalls);

                              // Handle REQUEST_SCAN
                              const scanReq = finalOps.find((o: any) => o?.type === 'REQUEST_SCAN');
                              if (scanReq && !context.scanPage) {
                                storeState.showToast('Scanning page...', 'info');
                                storeState.addChatMessage({
                                  id: `msg-${Date.now()}`,
                                  role: 'assistant' as const,
                                  content: scanReq.reason || 'Escaneando a página...',
                                  timestamp: Date.now(),
                                  toolCalls: [{ id: `tc-scan-${Date.now()}`, name: 'scan_page', status: 'running' as const, startedAt: new Date().toISOString() }],
                                });
                                parent.postMessage(
                                  { pluginMessage: { type: 'GENERATE_WITH_CONTEXT', command: context.command, scanPage: true, ...context } },
                                  'https://www.figma.com',
                                );
                                break;
                              }

                              if (designOps.length > 0) {
                                parent.postMessage(
                                  { pluginMessage: { type: 'APPLY_OPERATIONS_FROM_API', operations: designOps, pageId: context.pageId } },
                                  'https://www.figma.com',
                                );
                                storeState.showToast(`Applying ${designOps.length} operation(s)…`, 'info');
                              }
                              break;
                            }
                            case 'error':
                              storeState.showToast(`Error: ${data.message}`, 'error');
                              if (!messageAdded) {
                                updateAssistantMessage(data.message || 'An error occurred');
                              }
                              break;
                          }
                        } catch {}
                        currentEvent = '';
                      }
                    }
                  }

                  // Handle rescan update for previous scan message
                  if (context.scanPage) {
                    const history = usePluginStore.getState().chatHistory;
                    const scanMsg = [...history].reverse().find((m) => m.toolCalls?.some((tc) => tc.name === 'scan_page' && tc.status === 'running'));
                    if (scanMsg) {
                      usePluginStore.setState((s) => {
                        const target = s.chatHistory.find((m) => m.id === scanMsg.id);
                        if (target?.toolCalls) {
                          target.toolCalls = target.toolCalls.map((tc) =>
                            tc.name === 'scan_page' && tc.status === 'running'
                              ? { ...tc, status: 'done' as const, endedAt: new Date().toISOString(), summary: 'Page scanned' }
                              : tc,
                          );
                        }
                      });
                    }
                  }
                }
              } catch (streamErr) {
                console.warn('SSE stream failed, falling back to non-streaming:', streamErr);
              }
            }

            // Fallback: non-streaming endpoint
            if (!streamSuccess) {
              storeState.showToast('Calling Gemini...', 'info');

              const response = await fetch(apiUrl('/plugin'), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(storeState.authToken ? { Authorization: `Bearer ${storeState.authToken}` } : {}),
                },
                body: JSON.stringify(context),
              });

              if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || `API error: ${response.status}`);
              }

              const result = await response.json();
              const ops: any[] = Array.isArray(result.operations) ? result.operations : [];

              if (context.scanPage) {
                const history = usePluginStore.getState().chatHistory;
                const scanMsg = [...history].reverse().find((m) => m.toolCalls?.some((tc) => tc.name === 'scan_page' && tc.status === 'running'));
                if (scanMsg) {
                  usePluginStore.setState((s) => {
                    const target = s.chatHistory.find((m) => m.id === scanMsg.id);
                    if (target?.toolCalls) {
                      target.toolCalls = target.toolCalls.map((tc) =>
                        tc.name === 'scan_page' && tc.status === 'running'
                          ? { ...tc, status: 'done' as const, endedAt: new Date().toISOString(), summary: 'Page scanned' }
                          : tc,
                      );
                    }
                  });
                }
              }

              const scanRequest = ops.find((o) => o?.type === 'REQUEST_SCAN');
              if (scanRequest && !context.scanPage) {
                storeState.showToast('Scanning page...', 'info');
                storeState.addChatMessage({
                  id: `msg-${Date.now()}`,
                  role: 'assistant' as const,
                  content: scanRequest.reason || 'Escaneando a página para encontrar os elementos...',
                  timestamp: Date.now(),
                  toolCalls: [{ id: `tc-scan-${Date.now()}`, name: 'scan_page', status: 'running' as const, startedAt: new Date().toISOString() }],
                });
                parent.postMessage(
                  { pluginMessage: { type: 'GENERATE_WITH_CONTEXT', command: context.command, scanPage: true, ...context } },
                  'https://www.figma.com',
                );
                break;
              }

              const messageOps = ops.filter((o) => o?.type === 'MESSAGE' && o.content);
              const designOps = ops.filter((o) => o?.type !== 'MESSAGE' && o?.type !== 'REQUEST_SCAN');
              const spokenText = messageOps.map((o) => String(o.content)).join('\n\n');
              const content =
                spokenText || result.text || result.response || result.message ||
                (designOps.length > 0 ? `Generated ${designOps.length} operation(s)` : 'Done');

              const toolCalls: any[] = result.toolCallRecord ? [result.toolCallRecord] : [];
              if (designOps.length > 0 && !toolCalls.some((tc: any) => tc.name === 'generate_figma_operations')) {
                toolCalls.push({
                  id: `tc-gen-${Date.now()}`,
                  name: 'generate_figma_operations',
                  status: 'done' as const,
                  startedAt: new Date().toISOString(),
                  endedAt: new Date().toISOString(),
                  summary: `${designOps.length} operation${designOps.length > 1 ? 's' : ''} via ${result.provider || 'gemini'}`,
                });
              }

              storeState.addChatMessage({
                id: `msg-${Date.now()}`,
                role: 'assistant' as const,
                content,
                timestamp: Date.now(),
                operations: designOps,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                metadata: result.usage ? { usage: result.usage } : undefined,
              });

              if (designOps.length > 0) {
                parent.postMessage(
                  { pluginMessage: { type: 'APPLY_OPERATIONS_FROM_API', operations: designOps, pageId: context.pageId } },
                  'https://www.figma.com',
                );
                storeState.showToast(`Applying ${designOps.length} operation(s)…`, 'info');
              }
            }
          } catch (err) {
            console.error('API call failed:', err);
            const errorMsg = (err as Error).message;
            storeState.addChatMessage({
              id: `msg-err-${Date.now()}`,
              role: 'assistant' as const,
              content: `⚠ ${errorMsg}`,
              timestamp: Date.now(),
              isError: true,
            });
          } finally {
            storeState.setIsGenerating(false);
            usePluginStore.getState().setGeneratingStatus('');
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
