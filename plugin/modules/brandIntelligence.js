/**
 * Brand Intelligence Module
 * Analyzes a selected Figma node with Gemini and saves it as a design reference
 * (with extracted dos/donts/tips) on the active brand guideline.
 */

(function () {
  let _initialized = false;

  function init() {
    if (_initialized) return;
    _initialized = true;

    const syncBtn = document.getElementById('intelSyncReferenceBtn');
    console.log('[BrandIntel] init, syncBtn=', syncBtn);
    if (syncBtn) {
      syncBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[BrandIntel] button clicked');
        handleSyncReference();
      });
    } else {
      // Fallback: delegated listener in case button is re-rendered
      document.addEventListener('click', (e) => {
        const t = e.target.closest && e.target.closest('#intelSyncReferenceBtn');
        if (t) {
          e.preventDefault();
          e.stopPropagation();
          console.log('[BrandIntel] button clicked (delegated)');
          handleSyncReference();
        }
      });
    }

    // Re-render whenever the active brand guideline changes
    if (typeof watchState === 'function') {
      watchState('brandGuideline', () => loadBrandIntelligence());
    }

    loadBrandIntelligence();
  }

  /**
   * Export the currently selected node and POST it to the intelligence endpoint.
   */
  async function handleSyncReference() {
    console.log('[BrandIntel] handleSyncReference triggered');
    const brand = state.brandGuideline;
    const brandId = brand && (brand.id || brand._id);
    
    if (!brandId) {
      showToast('Selecione uma marca no Brand Hub primeiro.', 'warning');
      return;
    }

    const selection = (state.selectionDetails || [])[0];
    if (!selection || !selection.id) {
      showToast('Selecione um layout no Figma para analisar.', 'warning');
      return;
    }

    // Feedback visual superior: Trocar para o Chat para mostrar o Glitch Loader
    if (window.uiManager) window.uiManager.closeSettings();
    const analyzeWords = ['Extraindo Estilo...', 'Analisando Layout...', 'Catalogando...', 'Entendendo Design...'];
    if (window.chatModule) window.chatModule.showTypingBubble(analyzeWords);

    const btn = document.getElementById('intelSyncReferenceBtn');
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
    }

    try {
      showToast('Extraindo inteligência do design...', 'info');

      if (!window.brandSyncModule || typeof window.brandSyncModule.exportNodeImage !== 'function') {
        throw new Error('Módulo de exportação indisponível.');
      }

      console.log('[BrandIntel] Exporting node:', selection.id);
      const exported = await window.brandSyncModule.exportNodeImage(selection.id, 'PNG');
      if (!exported || !exported.data) {
        throw new Error('Falha ao exportar a seleção do Figma.');
      }

      console.log('[BrandIntel] Sending to server for brand:', brandId);
      const result = await apiCall(`/brand-intelligence/${brandId}/sync`, 'POST', {
        imageData: exported.data, // data:image/png;base64,...
        name: selection.name || 'Referência Selecionada',
        context: selection.type || undefined,
      });

      if (result && result.success && result.guideline) {
        console.log('[BrandIntel] Sync successful, updating state');
        // Update the in-memory brand guideline → triggers re-render via watchState
        const updated = { ...result.guideline };
        if (!updated.id && updated._id) updated.id = updated._id;
        setState('brandGuideline', updated);

        const tipsCount = (result.analysis && result.analysis.principles && result.analysis.principles.tips || []).length;
        const dosCount = (result.analysis && result.analysis.principles && result.analysis.principles.dos || []).length;
        
        showToast(
          `Inteligência extraída! ${dosCount} regras e ${tipsCount} dicas salvas na marca.`,
          'success'
        );

        if (window.chatModule) {
          window.chatModule.addAssistantMessage(
            `✦ **Inteligência de Design Extraída** de "${selection.name}"\n\nForam identificadas **${dosCount} novas regras** de design para a marca **${brand.name || ''}**.`,
          );
        }
      } else {
        throw new Error(result?.error || 'Resposta inválida do servidor.');
      }
    } catch (err) {
      console.error('[Brand Intel] Sync failed:', err);
      showToast(`Falha na análise: ${err.message}`, 'error');
      if (window.chatModule) window.chatModule.addErrorMessage(`Falha na inteligência: ${err.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
      if (window.chatModule) window.chatModule.removeTypingBubble();
    }
  }

  /**
   * Render references stored on the current brand guideline.
   */
  function loadBrandIntelligence() {
    const listEl = document.getElementById('brandIntelList');
    const emptyEl = document.getElementById('brandIntelEmpty');
    if (!listEl || !emptyEl) return;

    const brand = state.brandGuideline;
    const media = (brand && brand.media) || [];
    const references = media.filter((m) => m && m.type === 'reference');

    if (references.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    listEl.innerHTML = references
      .map(
        (ref) => `
      <div class="intel-card" data-id="${ref.id}" title="${escapeHtml(ref.label || '')}">
        <div class="intel-thumb-wrap">
          <img src="${ref.url}" class="intel-thumb" />
          ${ref.tags && ref.tags[0] ? `<div class="intel-badge">${escapeHtml(ref.tags[0])}</div>` : ''}
        </div>
        <div class="intel-info">
          <span class="intel-name">${escapeHtml(ref.label || 'Referência')}</span>
        </div>
      </div>
    `
      )
      .join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  window.brandIntelligence = { init, loadBrandIntelligence };
})();
