/**
 * BrandModals — Extracted complex modals.
 *
 * Houses the two HTML-heavy flows that were bloating brand.js:
 *   1. Smart Scan modal — categorize scanned Figma selection items
 *   2. Push to Webapp preview — diff local brand vs. remote guideline
 *
 * These are exported as static methods taking the owning BrandModule
 * as context (for `linkBrandGuideline` + `brandGuidelineSelect` access).
 */

function _hexToCmyk(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

const BrandModals = {
  // ═══ SMART SCAN MODAL ═══
  showSmartScan(items, applyFn) {
    const esc = (s) => s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
    const categories = [
      { value: 'logo', label: 'Logo' },
      { value: 'font', label: 'Font' },
      { value: 'color', label: 'Color' },
      { value: 'component', label: 'Component' },
      { value: 'skip', label: 'Skip' },
    ];

    let html = `<div class="modal" id="smart-scan-modal">
      <div class="modal-content" style="max-width:360px;">
        <div class="modal-header">
          <span class="modal-title">Smart Scan — ${items.length} element${items.length > 1 ? 's' : ''}</span>
          <button class="modal-close" id="smart-scan-close">&times;</button>
        </div>
        <div class="modal-body" style="padding:10px 12px;max-height:50vh;overflow-y:auto;">`;

    items.forEach((item, i) => {
      const catOptions = categories.map(c =>
        `<option value="${c.value}"${c.value === item.category ? ' selected' : ''}>${c.label}</option>`
      ).join('');

      html += `<div class="smart-scan-item" data-index="${i}" style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--figma-color-border,#eee);">`;

      if (item.category === 'color' && item.colorData) {
        html += `<div style="width:24px;height:24px;border-radius:4px;background:${esc(item.colorData.hex)};border:1px solid var(--figma-color-border,#ddd);flex-shrink:0;"></div>`;
      } else if (item.thumbnail) {
        html += `<img src="${item.thumbnail}" style="width:24px;height:24px;border-radius:4px;object-fit:contain;background:var(--figma-color-bg-secondary,#f5f5f5);flex-shrink:0;">`;
      } else {
        html += `<div style="width:24px;height:24px;border-radius:4px;background:var(--figma-color-bg-secondary,#f5f5f5);display:flex;align-items:center;justify-content:center;font-size:10px;opacity:0.5;flex-shrink:0;">${esc(item.type?.charAt(0) || '?')}</div>`;
      }

      html += `<div style="flex:1;min-width:0;overflow:hidden;">
        <div style="font-size:10px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(item.name)}</div>`;
      if (item.category === 'font' && item.fontData) {
        html += `<div style="font-size:10px;opacity:0.5;">${esc(item.fontData.family)} ${esc(item.fontData.style)}</div>`;
      } else if (item.category === 'color' && item.colorData) {
        html += `<div style="font-size:10px;opacity:0.5;">${esc(item.colorData.hex)}</div>`;
      } else {
        html += `<div style="font-size:10px;opacity:0.5;">${item.width}×${item.height}</div>`;
      }
      html += `</div>`;

      html += `<select class="smart-scan-cat" data-index="${i}" style="padding:3px 4px;border-radius:4px;border:1px solid var(--figma-color-border,#e5e5e5);font-size:10px;background:var(--figma-color-bg,#fff);color:var(--figma-color-text,#333);">${catOptions}</select>`;
      html += `</div>`;
    });

    html += `</div>
        <div style="padding:10px 12px;display:flex;gap:6px;border-top:1px solid var(--figma-color-border,#eee);">
          <button class="figma-button figma-button--secondary" id="smart-scan-cancel" style="flex:1;">Cancel</button>
          <button class="figma-button figma-button--primary" id="smart-scan-apply" style="flex:1;background:#0ACF83;border-color:#0ACF83;color:#fff;">Apply</button>
        </div>
      </div></div>`;

    document.getElementById('smart-scan-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    const modal = document.getElementById('smart-scan-modal');
    const close = () => modal?.remove();
    document.getElementById('smart-scan-close')?.addEventListener('click', close);
    document.getElementById('smart-scan-cancel')?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('smart-scan-apply')?.addEventListener('click', () => {
      const selects = modal.querySelectorAll('.smart-scan-cat');
      const assignments = [];
      selects.forEach(sel => {
        const idx = parseInt(sel.dataset.index);
        assignments.push({ ...items[idx], category: sel.value });
      });
      applyFn(assignments);
      close();
    });
  },

  /** Apply scanned items to brand state based on their assigned categories. */
  applySmartScan(assignments) {
    let logosAdded = 0, fontsAdded = 0, colorsAdded = 0, compsAdded = 0;

    for (const item of assignments) {
      if (item.category === 'skip') continue;

      if (item.category === 'logo' && item.componentData) {
        const logos = [...state.logos];
        let slotIdx = logos.findIndex(l => !l.value);
        if (slotIdx === -1) {
          slotIdx = logos.length;
          logos.push({ id: `scan-${Date.now()}-${slotIdx}`, label: item.name, value: null });
        }
        logos[slotIdx].value = {
          id: item.componentData.id,
          name: item.componentData.name,
          key: item.componentData.key,
          thumbnail: item.thumbnail,
        };
        logos[slotIdx].label = item.name;
        setState('logos', logos);
        logosAdded++;
      }

      if (item.category === 'font' && item.fontData) {
        const typo = [...state.typography];
        let slotIdx = typo.findIndex(t => !t.value);
        if (slotIdx === -1) {
          slotIdx = typo.length;
          typo.push({ id: `scan-${Date.now()}-${slotIdx}`, label: item.suggestedRole || 'Font', value: null });
        }
        typo[slotIdx].value = item.fontData;
        if (item.suggestedRole && !typo[slotIdx].label?.startsWith('custom')) {
          const roleLabel = item.suggestedRole.charAt(0).toUpperCase() + item.suggestedRole.slice(1);
          if (typo[slotIdx].label === 'Nova Fonte') typo[slotIdx].label = roleLabel;
        }
        setState('typography', typo);
        fontsAdded++;
      }

      if (item.category === 'color' && item.colorData) {
        const colors = state.selectedColors instanceof Map ? new Map(state.selectedColors) : new Map();
        const colorId = `scan-${item.colorData.hex.replace('#', '')}`;
        if (!colors.has(colorId)) {
          colors.set(colorId, {
            name: item.colorData.name || item.colorData.hex,
            value: item.colorData.hex,
            role: item.colorData.role || '',
          });
          setState('selectedColors', colors);
          colorsAdded++;
        }
      }

      if (item.category === 'component' && item.componentData) {
        const comps = state.selectedUIComponents || {};
        const key = item.componentData.name;
        if (!comps[key]) {
          comps[key] = {
            id: item.componentData.id,
            name: item.componentData.name,
            key: item.componentData.key,
            thumbnail: item.thumbnail,
          };
          setState('selectedUIComponents', { ...comps });
          compsAdded++;
        }
      }
    }

    const parts = [];
    if (logosAdded) parts.push(`${logosAdded} logo${logosAdded > 1 ? 's' : ''}`);
    if (fontsAdded) parts.push(`${fontsAdded} font${fontsAdded > 1 ? 's' : ''}`);
    if (colorsAdded) parts.push(`${colorsAdded} color${colorsAdded > 1 ? 's' : ''}`);
    if (compsAdded) parts.push(`${compsAdded} component${compsAdded > 1 ? 's' : ''}`);

    if (parts.length > 0) {
      eventBus.emit('toast:success', { message: `Applied: ${parts.join(', ')}` });
    } else {
      eventBus.emit('toast:error', { message: 'No items to apply' });
    }
  },

  // ═══ PUSH TO WEBAPP PREVIEW ═══
  async showPushToWebapp(brandModule) {
    const guidelines = state.apiGuidelines || await window.brandSyncModule?.fetchList() || [];
    const currentId = state.linkedGuidelineId;

    // Gather current plugin state
    const colors = [];
    if (state.selectedColors instanceof Map) {
      for (const [id, c] of state.selectedColors) {
        colors.push({ hex: c.value, name: c.name, role: c.role || '', variableId: c.variableId });
      }
    }

    const logos = [];
    for (const l of (state.logos || [])) {
      if (l.value) {
        logos.push({
          label: l.label || 'Logo',
          name: l.value.name,
          nodeId: l.value.id,
          thumbnail: l.value.thumbnail,
        });
      }
    }

    const typography = [];
    for (const t of (state.typography || [])) {
      if (t.value) {
        typography.push({
          family: t.value.family || t.value.name,
          role: t.label || 'body',
          availableStyles: t.value.availableStyles || ['Regular'],
        });
      }
    }

    const tokens = state.designTokens || {};
    const spacingKeys = Object.keys(tokens.spacing || {}).filter(k => tokens.spacing[k]);
    const radiusKeys = Object.keys(tokens.radius || {}).filter(k => tokens.radius[k]);

    const remote = state.linkedGuideline || null;
    const remoteColors = (remote?.colors || []);
    const remoteTypo = (remote?.typography || []);
    const remoteTokens = remote?.tokens || {};
    const remoteLogos = (remote?.logos || remote?.identity?.logos || []);

    const remoteColorHexes = new Map(remoteColors.map(c => [c.hex?.toUpperCase(), c]));
    const diffColors = [];
    for (const c of colors) {
      const hexUp = c.hex?.toUpperCase();
      const match = remoteColorHexes.get(hexUp);
      if (!match) {
        diffColors.push({ ...c, _diff: 'new' });
      } else if ((match.name || '') !== (c.name || '') || (match.role || '') !== (c.role || '')) {
        diffColors.push({ ...c, _diff: 'changed' });
      }
    }

    const remoteTypoFamilies = new Map(remoteTypo.map(t => [t.family?.toLowerCase(), t]));
    const diffTypo = [];
    for (const t of typography) {
      const fam = t.family?.toLowerCase();
      const match = remoteTypoFamilies.get(fam);
      if (!match) {
        diffTypo.push({ ...t, _diff: 'new' });
      } else if ((match.style || 'Regular') !== (t.style || 'Regular') || (match.role || '') !== (t.role || '')) {
        diffTypo.push({ ...t, _diff: 'changed' });
      }
    }

    const remoteLogoNames = new Set((Array.isArray(remoteLogos) ? remoteLogos : []).map(l => (l.label || l.name || '').toLowerCase()));
    const diffLogos = [];
    for (const l of logos) {
      if (!remoteLogoNames.has((l.label || l.name || '').toLowerCase())) {
        diffLogos.push({ ...l, _diff: 'new' });
      }
    }

    const remoteSpacing = remoteTokens.spacing || {};
    const diffSpacingKeys = spacingKeys.filter(k => String(tokens.spacing[k]) !== String(remoteSpacing[k] || ''));
    const remoteRadius = remoteTokens.radius || {};
    const diffRadiusKeys = radiusKeys.filter(k => String(tokens.radius[k]) !== String(remoteRadius[k] || ''));

    const isNewTarget = !remote;
    const showColors = isNewTarget ? colors : diffColors;
    const showTypo = isNewTarget ? typography : diffTypo;
    const showLogos = isNewTarget ? logos : diffLogos;
    const showSpacingKeys = isNewTarget ? spacingKeys : diffSpacingKeys;
    const showRadiusKeys = isNewTarget ? radiusKeys : diffRadiusKeys;

    const esc = (s) => s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
    const diffBadge = (diff) => {
      if (!diff) return '';
      if (diff === 'new') return '<span style="font-size:10px;padding:1px 4px;border-radius:3px;background:#0ACF83;color:#fff;margin-left:4px;">NEW</span>';
      return '<span style="font-size:10px;padding:1px 4px;border-radius:3px;background:#F7B500;color:#333;margin-left:4px;">CHANGED</span>';
    };
    const cb = (id, label, count, checked = true) =>
      `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:3px 0;">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} style="accent-color:#0ACF83;margin:0;">
        <span style="font-size:10px;font-weight:600;color:var(--figma-color-text-secondary,#666);">${label}</span>
        <span style="font-size:10px;opacity:0.5;margin-left:auto;">${count}</span>
      </label>`;

    let html = `<div class="modal" id="sync-preview-modal">
      <div class="modal-content" style="max-width:340px;">
        <div class="modal-header">
          <span class="modal-title">Push to Webapp</span>
          <button class="modal-close" id="sync-preview-close">&times;</button>
        </div>
        <div class="modal-body" style="padding:12px;">`;

    html += `<div style="margin-bottom:12px;">
      <label style="font-size:10px;font-weight:600;color:var(--figma-color-text-secondary,#666);display:block;margin-bottom:4px;">Destination guideline</label>
      <select id="sync-target-select" style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid var(--figma-color-border,#e5e5e5);background:var(--figma-color-bg,#fff);color:var(--figma-color-text,#333);font-size:11px;">`;
    for (const g of guidelines) {
      const gId = g._id || g.id;
      const gName = g.identity?.name || 'Unnamed';
      html += `<option value="${esc(gId)}"${gId === currentId ? ' selected' : ''}>${esc(gName)}</option>`;
    }
    html += `<option value="__new__">+ Create new</option></select></div>`;

    if (showLogos.length > 0) {
      html += `<div style="margin-bottom:10px;">`;
      html += cb('sync-logos', 'Logos', showLogos.length);
      html += `<div id="sync-logos-preview" style="display:flex;flex-wrap:wrap;gap:4px;padding:4px 0 0 22px;">`;
      for (const l of showLogos) {
        html += `<div style="display:flex;align-items:center;gap:4px;font-size:10px;opacity:0.8;">`;
        if (l.thumbnail) html += `<img src="${l.thumbnail}" style="width:20px;height:20px;border-radius:3px;object-fit:contain;background:var(--figma-color-bg-secondary,#f5f5f5);">`;
        html += `${esc(l.label)}${diffBadge(l._diff)}</div>`;
      }
      html += `</div></div>`;
    }

    if (showColors.length > 0) {
      html += `<div style="margin-bottom:10px;">`;
      html += cb('sync-colors', 'Colors', showColors.length);
      html += `<div id="sync-colors-preview" style="display:flex;flex-wrap:wrap;gap:3px;padding:4px 0 0 22px;">`;
      for (const c of showColors) {
        const border = c._diff === 'new' ? '2px solid #0ACF83' : c._diff === 'changed' ? '2px solid #F7B500' : '1px solid var(--figma-color-border,#ddd)';
        html += `<div title="${esc(c.name)} ${esc(c.hex)}${c._diff ? ' (' + c._diff + ')' : ''}" style="width:16px;height:16px;border-radius:3px;background:${esc(c.hex)};border:${border};"></div>`;
      }
      html += `</div></div>`;
    }

    if (showTypo.length > 0) {
      html += `<div style="margin-bottom:10px;">`;
      html += cb('sync-typography', 'Typography', showTypo.length);
      html += `<div id="sync-typo-preview" style="padding:2px 0 0 22px;">`;
      for (const t of showTypo) {
        html += `<div style="font-size:10px;padding:1px 0;opacity:0.8;">${esc(t.family)} ${esc(t.style)} <small style="opacity:0.5">${esc(t.role)}</small>${diffBadge(t._diff)}</div>`;
      }
      html += `</div></div>`;
    }

    if (showSpacingKeys.length > 0) html += cb('sync-spacing', 'Spacing', showSpacingKeys.length);
    if (showRadiusKeys.length > 0) html += cb('sync-radius', 'Radius', showRadiusKeys.length);

    const hasChanges = showLogos.length > 0 || showColors.length > 0 || showTypo.length > 0 || showSpacingKeys.length > 0 || showRadiusKeys.length > 0;
    const isEmpty = logos.length === 0 && colors.length === 0 && typography.length === 0 && spacingKeys.length === 0 && radiusKeys.length === 0;

    if (isEmpty) {
      html += `<div style="text-align:center;padding:12px;opacity:0.5;font-size:10px;">No tokens configured in Brand tab.</div>`;
    } else if (!hasChanges) {
      html += `<div style="text-align:center;padding:12px;opacity:0.5;font-size:10px;">✓ Everything is in sync — no changes to push.</div>`;
    }

    html += `<div style="font-size:10px;color:var(--figma-color-text-secondary,#888);margin:10px 0 4px;padding-top:6px;border-top:1px solid var(--figma-color-border,#eee);">${hasChanges ? 'Only showing items that differ from the webapp.' : 'All local items match the webapp guideline.'}</div>`;

    html += `<div style="display:flex;gap:6px;margin-top:4px;">
        <button class="figma-button figma-button--secondary" id="sync-preview-cancel" style="flex:1;">Cancel</button>
        <button class="figma-button figma-button--primary" id="sync-preview-confirm" style="flex:1;background:#0ACF83;border-color:#0ACF83;color:#fff;"${!hasChanges ? ' disabled' : ''}>Push changes</button>
      </div>`;

    html += `</div></div></div>`;

    document.getElementById('sync-preview-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    const modal = document.getElementById('sync-preview-modal');
    const close = () => modal?.remove();
    document.getElementById('sync-preview-close')?.addEventListener('click', close);
    document.getElementById('sync-preview-cancel')?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('sync-logos')?.addEventListener('change', (e) => {
      const p = document.getElementById('sync-logos-preview');
      if (p) p.style.display = e.target.checked ? 'flex' : 'none';
    });
    document.getElementById('sync-colors')?.addEventListener('change', (e) => {
      const p = document.getElementById('sync-colors-preview');
      if (p) p.style.display = e.target.checked ? 'flex' : 'none';
    });
    document.getElementById('sync-typography')?.addEventListener('change', (e) => {
      const p = document.getElementById('sync-typo-preview');
      if (p) p.style.display = e.target.checked ? 'block' : 'none';
    });

    const selectEl = document.getElementById('sync-target-select');

    document.getElementById('sync-preview-confirm')?.addEventListener('click', async () => {
      let targetId = selectEl?.value;
      const confirmBtn = document.getElementById('sync-preview-confirm');
      if (confirmBtn) { confirmBtn.textContent = 'Pushing...'; confirmBtn.disabled = true; }

      try {
        if (targetId === '__new__') {
          const newG = await window.brandSyncModule.create();
          if (!newG) throw new Error('Failed to create guideline');
          targetId = newG._id || newG.id;
        }

        const payload = {};
        const syncLogos = document.getElementById('sync-logos')?.checked && showLogos.length > 0;

        if (document.getElementById('sync-colors')?.checked && showColors.length > 0) {
          payload.colors = colors.map(c => ({ hex: c.hex, name: c.name, role: c.role, cmyk: _hexToCmyk(c.hex) }));
        }
        if (document.getElementById('sync-typography')?.checked && showTypo.length > 0) {
          payload.typography = typography;
        }
        if (document.getElementById('sync-spacing')?.checked && showSpacingKeys.length > 0) {
          payload.tokens = payload.tokens || {};
          payload.tokens.spacing = tokens.spacing;
        }
        if (document.getElementById('sync-radius')?.checked && showRadiusKeys.length > 0) {
          payload.tokens = payload.tokens || {};
          payload.tokens.radius = tokens.radius;
        }

        if (Object.keys(payload).length === 0 && !syncLogos) {
          eventBus.emit('toast:error', { message: 'Nothing selected to push' });
          return;
        }

        if (Object.keys(payload).length > 0) {
          await window.apiCall(`/brand-guidelines/${targetId}`, 'PUT', payload);
        }

        let logoCount = 0;
        if (syncLogos) {
          if (confirmBtn) confirmBtn.textContent = 'Exporting logos...';
          for (const logo of showLogos) {
            if (!logo.nodeId) continue;
            try {
              const exported = await window.brandSyncModule.exportNodeImage(logo.nodeId, 'SVG');
              if (!exported?.data) continue;
              await window.apiCall(`/brand-guidelines/${targetId}/logos`, 'POST', {
                data: exported.data,
                variant: 'custom',
                label: logo.label || logo.name,
              });
              logoCount++;
            } catch (e) {
              console.warn('[Brand] Logo export failed for', logo.name, e?.message);
            }
          }
        }

        const parts = [];
        if (logoCount > 0) parts.push(`${logoCount} logos`);
        if (payload.colors) parts.push(`${payload.colors.length} colors`);
        if (payload.typography) parts.push(`${payload.typography.length} fonts`);
        if (payload.tokens?.spacing) parts.push(`${Object.keys(payload.tokens.spacing).length} spacing`);
        if (payload.tokens?.radius) parts.push(`${Object.keys(payload.tokens.radius).length} radius`);
        if (parts.length > 0) {
          eventBus.emit('toast:success', { message: `Pushed: ${parts.join(', ')}` });
        }

        if (targetId !== currentId) {
          brandModule.brandGuidelineSelect.value = targetId;
        }
        await brandModule.linkBrandGuideline(targetId, { force: true });

        close();
      } catch (e) {
        eventBus.emit('toast:error', { message: e.message || 'Push failed' });
        if (confirmBtn) { confirmBtn.textContent = 'Push'; confirmBtn.disabled = false; }
      }
    });
  },
};

window.BrandModals = BrandModals;
