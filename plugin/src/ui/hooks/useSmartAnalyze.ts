import { useCallback } from 'react';
import { usePluginStore } from '../store';
import { useFigmaMessages } from './useFigmaMessages';
import { apiUrl } from '../config';

type AnalyzeMode = 'figma-plugin' | 'image-gen';

function waitForMessage<T = any>(type: string, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error(`Timeout waiting for ${type}`));
    }, timeoutMs);

    function handler(event: MessageEvent) {
      const msg = event.data?.pluginMessage;
      if (msg?.type === type) {
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        resolve(msg);
      }
    }

    window.addEventListener('message', handler);
  });
}

export function useSmartAnalyze() {
  const { send } = useFigmaMessages();
  const store = usePluginStore();

  const analyze = useCallback(
    async (mode: AnalyzeMode) => {
      const selection = store.selectionDetails;
      if (!selection || selection.length === 0) {
        store.showToast('Selecione algo no Figma primeiro', 'warning');
        return;
      }

      try {
        store.setIsGenerating(true);
        store.showToast('Iniciando Análise Inteligente...', 'info');

        send({ type: 'EXPORT_NODE_IMAGE', nodeId: 'selection', format: 'PNG' } as any);
        const exportResult = await waitForMessage<{ data?: string; error?: string }>('EXPORT_NODE_IMAGE_RESULT');
        if (exportResult.error || !exportResult.data) {
          throw new Error(exportResult.error || 'Falha ao capturar imagem');
        }

        const base64 = exportResult.data.includes(',') ? exportResult.data.split(',')[1] : exportResult.data;

        const components = store.designSystem?.tokens
          ? Object.values((store.designSystem.tokens as any).components || {})
          : [];

        const resp = await fetch(apiUrl('/plugin/smart-analyze'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(store.authToken ? { Authorization: `Bearer ${store.authToken}` } : {})
          },
          body: JSON.stringify({
            image: { base64, mimeType: 'image/png' },
            mode,
            brandGuideline: store.brandGuideline,
            availableComponents: components,
            params:
              mode === 'image-gen'
                ? { intensity: 'balanced', visualStyle: 'auto', aspectRatio: 'auto' }
                : { useAutoLayout: true, useSemanticNaming: true, useTokens: true, gridSnap: 8 }
          })
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: resp.statusText }));
          throw new Error(err.error || `API error: ${resp.status}`);
        }

        const result = await resp.json();
        if (!result.success) throw new Error(result.error || 'Análise falhou');

        if (mode === 'figma-plugin') {
          const ops = result.operations || [];
          store.addChatMessage({
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: `✦ Análise completa. Mapeados ${ops.length} componentes.`,
            timestamp: Date.now(),
            operations: ops
          });
          send({ type: 'APPLY_OPERATIONS_FROM_API', operations: ops } as any);
          store.showToast(`${ops.length} operações aplicadas`, 'success');
        } else {
          const prompt = result.prompt || '';
          store.addChatMessage({
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: `✦ Análise Visual completa.\n\n**Prompt:**\n\n\`${prompt}\``,
            timestamp: Date.now()
          });
          send({
            type: 'CREATE_STICKY_PROMPT',
            prompt,
            name: result.name || 'Image Analysis'
          } as any);
          store.showToast('Prompt gerado', 'success');
        }
      } catch (err) {
        console.error('[SmartAnalyze]', err);
        store.showToast(`Erro: ${(err as Error).message}`, 'error');
      } finally {
        store.setIsGenerating(false);
      }
    },
    [send, store]
  );

  return { analyze };
}
