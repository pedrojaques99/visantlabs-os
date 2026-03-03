const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// ── DOM refs ──
const statusEl = document.getElementById('status');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');
const contextInfoEl = document.getElementById('contextInfo');
const brandPill = document.getElementById('brandPill');
const selectionIndicator = document.getElementById('selectionIndicator');

// Brand panel refs
const componentsLibraryEl = document.getElementById('componentsLibrary');
const componentSearchEl = document.getElementById('componentSearch');
const colorGridEl = document.getElementById('colorGrid');
const colorGridEmptyEl = document.getElementById('colorGridEmpty');
const fontListEl = document.getElementById('fontList');
const fontSearchEl = document.getElementById('fontSearch');

// ── State ──
let currentSelectionDetails = [];
let currentSelectionThumb = null;
let selectedLogo = null;
let selectedFont = null;
let selectedColors = new Map();
let allComponents = [];
let componentThumbs = {};
let expandedFolders = new Set();
let showFolders = false;
let allFonts = []; // font variables from library
let allAvailableFonts = []; // all font families from Figma
let allColors = [];
let userApiKey = '';
let apiCollapsed = true;
let activeFontTab = 'library';
let openPanel = null; // 'logo' | 'colors' | 'fonts' | null
let savedGuidelines = []; // BrandGuideline[]
let activeGuidelineId = null; // string | null
let chatHistory = [{
    role: 'assistant',
    content: 'Olá! Descreva o que quer criar ou modificar. Configure as Brand Guidelines em ⚙ Configurações.',
    isError: false
}];

// ── View navigation ──
function openSettings() {
    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('settingsView').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settingsView').classList.add('hidden');
    document.getElementById('mainView').classList.remove('hidden');
    updateBrandPill();
}

// ── Selection indicator ──
function getNodeTypeIcon(type) {
    const icons = {
        'FRAME': '▢', 'GROUP': '▧', 'COMPONENT': '◇', 'COMPONENT_SET': '◈',
        'INSTANCE': '◆', 'TEXT': 'T', 'RECTANGLE': '■', 'ELLIPSE': '●',
        'VECTOR': '✦', 'LINE': '─', 'BOOLEAN_OPERATION': '⊞', 'SECTION': '§',
    };
    return icons[type] || '□';
}

function getNodeTypeLabel(type) {
    const labels = {
        'FRAME': 'Frame', 'GROUP': 'Grupo', 'COMPONENT': 'Componente',
        'COMPONENT_SET': 'Component Set', 'INSTANCE': 'Instância', 'TEXT': 'Texto',
        'RECTANGLE': 'Retângulo', 'ELLIPSE': 'Elipse', 'VECTOR': 'Vetor',
        'LINE': 'Linha', 'BOOLEAN_OPERATION': 'Boolean', 'SECTION': 'Seção',
    };
    return labels[type] || type;
}

function renderSelectionIndicator() {
    if (!currentSelectionDetails || currentSelectionDetails.length === 0) {
        selectionIndicator.classList.add('hidden');
        return;
    }
    selectionIndicator.classList.remove('hidden');
    if (currentSelectionDetails.length === 1) {
        const sel = currentSelectionDetails[0];
        const thumbHtml = currentSelectionThumb
            ? `<img class="sel-thumb" src="${currentSelectionThumb}" alt="">`
            : `<div class="sel-icon">${getNodeTypeIcon(sel.type)}</div>`;
        selectionIndicator.innerHTML = thumbHtml +
            `<div class="sel-info">` +
            `<div class="sel-name" title="${esc(sel.name)}">${esc(sel.name)}</div>` +
            `<div class="sel-type">${getNodeTypeLabel(sel.type)}</div></div>`;
    } else {
        const names = currentSelectionDetails.map(s => s.name).join(', ');
        selectionIndicator.innerHTML =
            `<div class="sel-icon">${currentSelectionDetails.length}</div>` +
            `<div class="sel-info">` +
            `<div class="sel-multi">${currentSelectionDetails.length} camadas selecionadas</div>` +
            `<div class="sel-type sel-multi-list" title="${esc(names)}">${esc(names)}</div></div>`;
    }
}

// ── Brand pill indicator ──
function updateBrandPill() {
    const active = selectedLogo || selectedFont || selectedColors.size > 0;
    brandPill.classList.toggle('active', !!active);
}

// ──────────────────────────────────────────────────
// ── Brand Guideline Presets ──
// ──────────────────────────────────────────────────

function renderGuidelinesSelector() {
    const sel = document.getElementById('guidelineSelect');
    const delBtn = document.getElementById('guidelineDeleteBtn');
    if (!sel) return;

    // Rebuild options
    const prev = sel.value;
    sel.innerHTML = '<option value="">— Nenhum —</option>';
    for (const g of savedGuidelines) {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = esc(g.name);
        sel.appendChild(opt);
    }

    // Restore selection
    sel.value = activeGuidelineId || '';

    if (delBtn) {
        delBtn.classList.toggle('hidden', !activeGuidelineId);
    }
}

function saveCurrentGuideline() {
    const name = prompt('Nome do guideline:', '');
    if (!name || !name.trim()) return;

    const id = activeGuidelineId || String(Date.now());
    const guideline = {
        id,
        name: name.trim(),
        logo: selectedLogo ? { id: selectedLogo.id, name: selectedLogo.name, key: selectedLogo.key } : undefined,
        font: selectedFont ? { id: selectedFont.id, name: selectedFont.name } : undefined,
        colors: Array.from(selectedColors.entries()).map(([cid, c]) => ({ id: cid, name: c.name, value: c.value }))
    };

    parent.postMessage({ pluginMessage: { type: 'SAVE_GUIDELINE', guideline } }, 'https://www.figma.com');
}

function onGuidelineSelectChange() {
    const sel = document.getElementById('guidelineSelect');
    const id = sel ? sel.value : '';
    if (!id) {
        activeGuidelineId = null;
        const delBtn = document.getElementById('guidelineDeleteBtn');
        if (delBtn) delBtn.classList.add('hidden');
        return;
    }
    activeGuidelineId = id;
    const guideline = savedGuidelines.find(g => g.id === id);
    if (guideline) applyGuideline(guideline);
    const delBtn = document.getElementById('guidelineDeleteBtn');
    if (delBtn) delBtn.classList.remove('hidden');
}

function applyGuideline(guideline) {
    // Apply logo
    if (guideline.logo) {
        selectedLogo = guideline.logo;
        // Make sure it's in allComponents so the library can render it selected
        if (!allComponents.find(c => c.id === guideline.logo.id)) {
            allComponents.push(guideline.logo);
        }
    } else {
        selectedLogo = null;
    }
    updateLogoPreview();

    // Apply colors
    selectedColors = new Map();
    if (Array.isArray(guideline.colors)) {
        for (const c of guideline.colors) {
            selectedColors.set(c.id, { name: c.name, value: c.value });
        }
    }
    updateColorsPreview();

    // Apply font
    selectedFont = guideline.font || null;
    updateFontsPreview();

    updateBrandPill();
    renderGuidelinesSelector();
}

function deleteActiveGuideline() {
    if (!activeGuidelineId) return;
    if (!confirm('Excluir este guideline?')) return;
    parent.postMessage({ pluginMessage: { type: 'DELETE_GUIDELINE', id: activeGuidelineId } }, 'https://www.figma.com');
    activeGuidelineId = null;
}

// ── Status ──
function showStatus(message, type = 'loading') {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
}

function hideStatus() {
    statusEl.textContent = '';
    statusEl.className = 'status';
}

// ── API section toggle ──
function toggleApiSection() {
    apiCollapsed = !apiCollapsed;
    document.getElementById('apiContent').classList.toggle('hidden', apiCollapsed);
    document.getElementById('apiChevron').classList.toggle('collapsed', apiCollapsed);
}

// ── API Key ──
function saveApiKey() {
    const key = document.getElementById('apiKeyInput').value.trim();
    userApiKey = key;
    parent.postMessage({ pluginMessage: { type: 'SAVE_API_KEY', key } }, 'https://www.figma.com');
}

// ── Send state ──
function updateSendState() {
    sendBtn.disabled = !chatInput.value.trim().length;
}

// ── Chat ──
function addChatMsg(role, content, isError = false) {
    chatHistory.push({ role, content, isError });
    renderChat();
}

function renderChat() {
    chatMessages.innerHTML = chatHistory.map(m => {
        const cls = `chat-msg ${m.role}${m.isError ? ' error' : ''}`;
        const text = (m.content || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
        return `<div class="${cls}">${text}</div>`;
    }).join('');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ═══════════════════════════════════════════
// ── Brand Panels ──
// ═══════════════════════════════════════════

function toggleBrandPanel(panel) {
    if (openPanel === panel) {
        // Close current panel
        document.getElementById(panel + 'Panel').classList.add('hidden');
        document.querySelector(`#${panel}Panel`).previousElementSibling.querySelector('.brand-add-btn').classList.remove('open');
        openPanel = null;
    } else {
        // Close previous panel if open
        if (openPanel) {
            document.getElementById(openPanel + 'Panel').classList.add('hidden');
            document.querySelector(`#${openPanel}Panel`).previousElementSibling.querySelector('.brand-add-btn').classList.remove('open');
        }
        // Open new panel
        document.getElementById(panel + 'Panel').classList.remove('hidden');
        document.querySelector(`#${panel}Panel`).previousElementSibling.querySelector('.brand-add-btn').classList.add('open');
        openPanel = panel;

        // Initialize panel content
        if (panel === 'colors') renderColorGrid();
        if (panel === 'fonts') renderFontList();
    }
}

// ── Logo ──
function selectLogo(comp) {
    selectedLogo = comp;
    updateLogoPreview();
    renderComponentsLibrary();
    updateBrandPill();
}

function clearLogo() {
    selectedLogo = null;
    updateLogoPreview();
    renderComponentsLibrary();
    updateBrandPill();
}

function updateLogoPreview() {
    const el = document.getElementById('logoPreview');
    if (!selectedLogo) {
        el.innerHTML = '';
        return;
    }
    const thumb = componentThumbs[selectedLogo.id];
    el.innerHTML = `<div class="preview-tag">` +
        (thumb ? `<img src="${thumb}" alt="">` : '') +
        `<span>${esc(selectedLogo.name)}</span>` +
        `<button class="remove-btn" onclick="event.stopPropagation(); clearLogo()">×</button>` +
        `</div>`;
}

function useSelectionAsLogo() {
    parent.postMessage({ pluginMessage: { type: 'USE_SELECTION_AS_LOGO' } }, 'https://www.figma.com');
}

// ── Folder tree (for logo component picker) ──
function toggleFolder(pathKey) {
    if (expandedFolders.has(pathKey)) expandedFolders.delete(pathKey);
    else expandedFolders.add(pathKey);
    renderComponentsLibrary();
}

function buildTree(components) {
    const root = { children: {}, comps: [] };
    for (const comp of components) {
        const path = comp.folderPath?.length ? comp.folderPath : ['Raiz'];
        let node = root;
        for (const part of path) {
            if (!node.children[part]) node.children[part] = { children: {}, comps: [] };
            node = node.children[part];
        }
        node.comps.push(comp);
    }
    return root;
}

function renderCompTile(comp) {
    const thumb = componentThumbs[comp.id];
    return `<div class="component-tile ${selectedLogo?.id === comp.id ? 'selected' : ''}" onclick="selectLogo(allComponents.find(c=>c.id==='${comp.id}'))" data-id="${comp.id}">` +
        (thumb ? `<img class="component-thumb" src="${thumb}" alt="">` : '<div class="component-thumb-placeholder">…</div>') +
        `<span class="component-name" title="${esc(comp.name)}">${esc(comp.name)}</span></div>`;
}

function renderFolderNode(node, pathPrefix) {
    let html = '';
    const folders = Object.keys(node.children || {});
    for (const name of folders) {
        const pathKey = [...pathPrefix, name].join('/');
        const isExpanded = expandedFolders.has(pathKey);
        const escapedPathKey = pathKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        html += `<div class="folder-row" onclick="toggleFolder('${escapedPathKey}')">` +
            `<span class="folder-chevron ${isExpanded ? '' : 'collapsed'}">▸</span>` +
            `<span class="folder-name">${name.replace(/</g, '&lt;')}</span></div>`;
        if (isExpanded) {
            const child = node.children[name];
            html += `<div class="folder-children">${renderFolderNode(child, [...pathPrefix, name])}`;
            for (const comp of child.comps || []) html += renderCompTile(comp);
            html += '</div>';
        }
    }
    for (const comp of node.comps || []) html += renderCompTile(comp);
    return html;
}

function flattenTree(node) {
    const comps = [];
    for (const comp of node.comps || []) comps.push(comp);
    for (const child of Object.values(node.children || {})) {
        comps.push(...flattenTree(child));
    }
    return comps;
}

function toggleShowFolders() {
    showFolders = document.getElementById('showFoldersCheckbox').checked;
    renderComponentsLibrary();
}

function renderComponentsLibrary() {
    const searchTerm = (componentSearchEl ? componentSearchEl.value : '').toLowerCase().trim();
    const filtered = searchTerm
        ? allComponents.filter(c => (c.name || '').toLowerCase().includes(searchTerm))
        : allComponents;

    if (!filtered.length) {
        componentsLibraryEl.innerHTML = `<div class="components-loading">${searchTerm ? 'Nenhum resultado' : 'Nenhum componente encontrado'}</div>`;
        return;
    }

    // Render in flat mode (default) or folder tree mode
    if (!showFolders) {
        // Flat mode: just grid of components
        const html = filtered.map(comp => renderCompTile(comp)).join('');
        componentsLibraryEl.innerHTML = html || '<div class="components-loading">Nenhum componente</div>';
    } else {
        // Folder tree mode
        const tree = buildTree(filtered);
        const folders = Object.keys(tree.children || {});
        const rootComps = tree.comps || [];
        let html = '';

        for (const name of folders) {
            const pathKey = name;
            const isExpanded = expandedFolders.has(pathKey) || expandedFolders.size === 0;
            if (expandedFolders.size === 0) expandedFolders.add(pathKey);
            const escapedPathKey = pathKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            html += `<div class="folder-row" onclick="toggleFolder('${escapedPathKey}')">` +
                `<span class="folder-chevron ${isExpanded ? '' : 'collapsed'}">▸</span>` +
                `<span class="folder-name">${name.replace(/</g, '&lt;')}</span></div>`;
            if (isExpanded) html += `<div class="folder-children">${renderFolderNode(tree.children[name], [name])}</div>`;
        }

        for (const comp of rootComps) html += renderCompTile(comp);
        componentsLibraryEl.innerHTML = html || '<div class="components-loading">Nenhum componente</div>';
    }
}

// ── Colors ──
function toggleColor(colorId, colorName, colorValue) {
    if (selectedColors.has(colorId)) selectedColors.delete(colorId);
    else selectedColors.set(colorId, { name: colorName, value: colorValue });
    renderColorGrid();
    updateColorsPreview();
    updateBrandPill();
}

function renderColorGrid() {
    if (!allColors.length) {
        colorGridEl.innerHTML = '';
        colorGridEmptyEl.classList.remove('hidden');
        return;
    }
    colorGridEmptyEl.classList.add('hidden');
    colorGridEl.innerHTML = allColors.map(color => {
        const isSelected = selectedColors.has(color.id);
        return `<button class="color-swatch${isSelected ? ' selected' : ''}" ` +
            `style="background: ${esc(color.value)} !important;" ` +
            `title="${esc(color.name)}" ` +
            `onclick="toggleColor('${color.id}','${esc(color.name)}','${esc(color.value)}')">` +
            `</button>`;
    }).join('');
}

function updateColorsPreview() {
    const el = document.getElementById('colorsPreview');
    if (selectedColors.size === 0) {
        el.innerHTML = '';
        return;
    }
    const dots = Array.from(selectedColors.values()).slice(0, 6).map(c =>
        `<span class="color-preview-dot" style="background: ${esc(c.value)};" title="${esc(c.name)}"></span>`
    ).join('');
    const extra = selectedColors.size > 6 ? `<span style="font-size:10px;color:var(--figma-color-text-tertiary,#b3b3b3)">+${selectedColors.size - 6}</span>` : '';
    el.innerHTML = dots + extra;
}

// ── Fonts ──
function switchFontTab(tab) {
    activeFontTab = tab;
    document.getElementById('fontTabLibrary').classList.toggle('active', tab === 'library');
    document.getElementById('fontTabAll').classList.toggle('active', tab === 'all');
    if (fontSearchEl) fontSearchEl.value = '';
    renderFontList();
}

function selectFontItem(id, name) {
    if (selectedFont && selectedFont.id === id) {
        selectedFont = null;
    } else {
        selectedFont = { id, name };
    }
    renderFontList();
    updateFontsPreview();
    updateBrandPill();
}

function clearFont() {
    selectedFont = null;
    renderFontList();
    updateFontsPreview();
    updateBrandPill();
}

function renderFontList() {
    const searchTerm = (fontSearchEl ? fontSearchEl.value : '').toLowerCase().trim();

    let items = [];
    if (activeFontTab === 'library') {
        items = allFonts.map(f => ({ id: f.id, name: f.name }));
    } else {
        items = allAvailableFonts.map(family => ({ id: 'font:' + family, name: family }));
    }

    if (searchTerm) {
        items = items.filter(f => f.name.toLowerCase().includes(searchTerm));
    }

    if (!items.length) {
        const msg = activeFontTab === 'library'
            ? (searchTerm ? 'Nenhum resultado' : 'Nenhuma variável de fonte na biblioteca')
            : (searchTerm ? 'Nenhum resultado' : 'Carregando fontes...');
        fontListEl.innerHTML = `<div class="font-list-empty">${msg}</div>`;
        return;
    }

    fontListEl.innerHTML = items.map(f => {
        const isSelected = selectedFont && selectedFont.id === f.id;
        return `<div class="font-list-item${isSelected ? ' selected' : ''}" onclick="selectFontItem('${esc(f.id)}','${esc(f.name)}')">` +
            `<span class="font-sample">${esc(f.name)}</span>` +
            (isSelected ? `<span class="font-check">✓</span>` : '') +
            `</div>`;
    }).join('');
}

function updateFontsPreview() {
    const el = document.getElementById('fontsPreview');
    if (!selectedFont) {
        el.innerHTML = '';
        return;
    }
    el.innerHTML = `<div class="preview-tag">` +
        `<span>${esc(selectedFont.name)}</span>` +
        `<button class="remove-btn" onclick="event.stopPropagation(); clearFont()">×</button>` +
        `</div>`;
}

// ── Send chat ──
function sendChat() {
    const command = chatInput.value.trim();
    if (!command) return;
    addChatMsg('user', command);
    chatInput.value = '';
    updateSendState();
    showStatus('🤖 Gerando design...', 'loading');

    chatInput.disabled = true;
    sendBtn.disabled = true;

    parent.postMessage({
        pluginMessage: {
            type: 'GENERATE_WITH_CONTEXT',
            command,
            logoComponent: selectedLogo,
            brandFont: selectedFont,
            brandColors: Array.from(selectedColors.values())
        }
    }, 'https://www.figma.com');
}

// ── API call ──
async function callPluginAPI(context) {
    try {
        const response = await fetch('https://www.visantlabs.com/api/plugin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...context, apiKey: userApiKey || undefined })
        });

        if (!response.ok) {
            let errorMsg = 'Falha ao gerar operações';
            try { const error = await response.json(); errorMsg = error.error || errorMsg; } catch (_e) { /* non-JSON error */ }
            handleApiError(errorMsg);
            return;
        }

        const data = await response.json();
        if (!data.success || !Array.isArray(data.operations)) {
            handleApiError('Resposta inválida da API');
            return;
        }
        parent.postMessage({ pluginMessage: { type: 'APPLY_OPERATIONS_FROM_API', operations: data.operations } }, 'https://www.figma.com');
    } catch (err) {
        handleApiError('Falha ao chamar API: ' + String(err));
    }
}

function handleApiError(message) {
    hideStatus();
    chatInput.disabled = false;
    updateSendState();
    addChatMsg('assistant', 'Erro: ' + message, true);
}

// ── Message handler ──
window.onmessage = (event) => {
    const msg = event.data.pluginMessage;
    if (!msg) return;

    if (msg.type === 'SELECTION_AS_LOGO') {
        if (msg.component) {
            selectedLogo = msg.component;
            if (!allComponents.find(c => c.id === msg.component.id)) allComponents.push(msg.component);
            updateLogoPreview();
            renderComponentsLibrary();
            updateBrandPill();
        } else {
            showStatus('Selecione um componente ou instância', 'error');
            setTimeout(hideStatus, 3000);
        }
    } else if (msg.type === 'COMPONENTS_LOADED') {
        hideStatus();
        allComponents = msg.components || [];
        if (allComponents.length) renderComponentsLibrary();
        else componentsLibraryEl.innerHTML = '<div class="components-loading">Nenhum componente encontrado</div>';
    } else if (msg.type === 'FONT_VARIABLES_LOADED') {
        hideStatus();
        allFonts = msg.fonts || [];
        if (openPanel === 'fonts' && activeFontTab === 'library') renderFontList();
    } else if (msg.type === 'AVAILABLE_FONTS_LOADED') {
        allAvailableFonts = msg.families || [];
        if (openPanel === 'fonts' && activeFontTab === 'all') renderFontList();
    } else if (msg.type === 'COLOR_VARIABLES_LOADED') {
        hideStatus();
        allColors = msg.colors || [];
        if (openPanel === 'colors') renderColorGrid();
    } else if (msg.type === 'COMPONENT_THUMBNAIL') {
        if (msg.componentId && msg.thumbnail) {
            componentThumbs[msg.componentId] = msg.thumbnail;
            renderComponentsLibrary();
            if (selectedLogo && selectedLogo.id === msg.componentId) updateLogoPreview();
        }
    } else if (msg.type === 'API_KEY_SAVED') {
        const el = document.getElementById('apiKeyStatus');
        el.textContent = userApiKey ? '✅ Chave salva' : '✅ Chave removida';
        el.style.color = 'var(--figma-color-text-success, #1b7a0a)';
    } else if (msg.type === 'API_KEY_LOADED') {
        userApiKey = msg.key || '';
        const input = document.getElementById('apiKeyInput');
        if (input) input.value = userApiKey;
        const el = document.getElementById('apiKeyStatus');
        if (el) el.textContent = userApiKey ? '🔑 Chave configurada' : 'Sem chave (usando servidor)';
    } else if (msg.type === 'CONTEXT_UPDATED') {
        const selectedElementsCount = Number.isFinite(Number(msg.selectedElements)) ? Number(msg.selectedElements) : 0;
        const componentsCount = Number.isFinite(Number(msg.componentsCount)) ? Number(msg.componentsCount) : 0;
        const colorVariablesCount = Number.isFinite(Number(msg.colorVariables)) ? Number(msg.colorVariables) : 0;
        contextInfoEl.textContent = `📦 ${selectedElementsCount} selecionado(s) • 🔧 ${componentsCount} componentes • 🎨 ${colorVariablesCount} cores`;

        currentSelectionDetails = msg.selectionDetails || [];
        currentSelectionThumb = null;
        renderSelectionIndicator();
    } else if (msg.type === 'SELECTION_THUMBNAIL') {
        if (currentSelectionDetails.length === 1 && currentSelectionDetails[0].id === msg.nodeId) {
            currentSelectionThumb = msg.thumbnail;
            renderSelectionIndicator();
        }
    } else if (msg.type === 'GUIDELINES_LOADED') {
        savedGuidelines = msg.guidelines || [];
        // If the active guideline was deleted, reset
        if (activeGuidelineId && !savedGuidelines.find(g => g.id === activeGuidelineId)) {
            activeGuidelineId = null;
        }
        renderGuidelinesSelector();
    } else if (msg.type === 'GUIDELINE_SAVED') {
        savedGuidelines = msg.guidelines || [];
        activeGuidelineId = msg.savedId;
        renderGuidelinesSelector();
    } else if (msg.type === 'CALL_API') {
        showStatus('🔗 Conectando à IA...', 'loading');
        callPluginAPI(msg.context);
    } else if (msg.type === 'OPERATIONS_DONE') {
        hideStatus();
        chatInput.disabled = false;
        updateSendState();
        if (msg.summary) {
            addChatMsg('assistant', `Design atualizado! ✨\n${msg.summary}`);
        } else {
            const countInfo = msg.count ? ` (${msg.count} operações)` : '';
            addChatMsg('assistant', `Design atualizado! ✨${countInfo}`);
        }
    } else if (msg.type === 'ERROR') {
        hideStatus();
        chatInput.disabled = false;
        updateSendState();
        addChatMsg('assistant', 'Erro: ' + msg.message, true);
    }
};

// ── Init ──
chatInput.addEventListener('input', updateSendState);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
});
brandPill.addEventListener('click', openSettings);

renderChat();
updateSendState();
parent.postMessage({ pluginMessage: { type: 'GET_CONTEXT' } }, 'https://www.figma.com');
parent.postMessage({ pluginMessage: { type: 'GET_API_KEY' } }, 'https://www.figma.com');
parent.postMessage({ pluginMessage: { type: 'GET_GUIDELINES' } }, 'https://www.figma.com');

