import { useCallback, useState } from 'react';
import { usePluginStore } from '../store';
import { useClient } from '../lib/ClientProvider';
import { useApi } from './useApi';
import { hydrateBrandGuideline } from '../lib/brandHydration';

/**
 * Extracts all text from the current Figma page as Markdown,
 * sends it to the brand ingest API (source: 'text'), and
 * re-hydrates the store with the updated guideline.
 *
 * Flow: collectTexts → MD → POST /brand-guidelines/:id/ingest → re-hydrate
 */
export function useBrandStrategyIngest() {
  const [isIngesting, setIsIngesting] = useState(false);
  const client = useClient();
  const { call } = useApi();
  const showToast = usePluginStore((s) => s.showToast);
  const selectionDetails = usePluginStore((s) => s.selectionDetails);

  const hasSelection = selectionDetails.length > 0;

  const run = useCallback(async () => {
    const { linkedGuideline, selectionDetails: sel } = usePluginStore.getState();
    if (!linkedGuideline) {
      showToast('Load a brand guideline first', 'warning');
      return null;
    }

    const nodeIds = sel.length > 0 ? sel.map((s) => s.id) : undefined;
    const scopeLabel = nodeIds
      ? `${sel.length} frame${sel.length > 1 ? 's' : ''}`
      : 'page';

    setIsIngesting(true);
    try {
      showToast(`Extracting from ${scopeLabel}…`, 'info');

      const { markdown, scope } = await client.request('export.textToMarkdown', {
        includeHidden: false,
        ...(nodeIds ? { nodeIds } : {}),
      });

      if (!markdown || markdown.includes('_No text layers found')) {
        showToast(
          scope === 'selection'
            ? 'No text found in selected frames'
            : 'No text found on this page',
          'warning'
        );
        return null;
      }

      const result = await call(`/api/brand-guidelines/${linkedGuideline}/ingest`, {
        method: 'POST',
        body: JSON.stringify({
          source: 'text',
          data: markdown,
          filename: 'figma-strategy.md',
        }),
      });

      if (!result?.guideline) {
        showToast('Ingest returned no data', 'error');
        return null;
      }

      const slice = hydrateBrandGuideline(result.guideline);
      const prev = usePluginStore.getState().brandHydrationTick || 0;
      usePluginStore.setState({
        ...(slice as any),
        brandHydrationTick: prev + 1,
        brandHydrationAtMs: Date.now(),
      });

      showToast(
        scope === 'selection'
          ? `Strategy populated from ${scopeLabel}`
          : 'Strategy populated from page texts',
        'success'
      );
      return result;
    } catch (err: any) {
      showToast(err.message || 'Failed to populate strategy', 'error');
      return null;
    } finally {
      setIsIngesting(false);
    }
  }, [client, call, showToast]);

  return { run, isIngesting, hasSelection };
}
