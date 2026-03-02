const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// ── DOM refs ──
const statusEl = document.getElementById('status');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');
const componentsLibraryEl = document.getElementById('componentsLibrary');
const fontSelectEl = document.getElementById('fontSelect');
const colorsList = document.getElementById('colorsList');
const selectedColorsEl = document.getElementById('selectedColors');
const contextInfoEl = document.getElementById('contextInfo');
const brandContent = document.getElementById('brandContent');
const brandChevron = document.getElementById('brandChevron');
const componentSearchEl = document.getElementById('componentSearch');
const brandPill = document.getElementById('brandPill');

// ── State ──
let selectedLogo = null;
let selectedFont = null;
let selectedColors = new Map();
let allComponents = [];
let componentThumbs = {};
let expandedFolders = new Set();
let allFonts = [];
let allColors = [];
let userApiKey = '';
let brandCollapsed = false;
let apiCollapsed = true;
let chatHistory = [{
    role: 'assistant',
    content: 'Olá! Descreva o que quer criar ou modificar. Opcionalmente, configure as Brand Guidelines em ⚙ Configurações.',
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

// ── Brand pill indicator ──
function updateBrandPill() {
    const active = selectedLogo || selectedFont || selectedColors.size > 0;
    brandPill.classList.toggle('active', !!active);
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

// ── Collapsible sections ──
function toggleBrandSection() {
    brandCollapsed = !brandCollapsed;
    brandContent.classList.toggle('hidden', brandCollapsed);
    brandChevron.classList.toggle('collapsed', brandCollapsed);
}

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

// ── Logo selection ──
function selectLogo(comp) {
    selectedLogo = comp;
    document.getElementById('selectedLogo').innerHTML =
        `<div class="selected-tag">${esc(comp.name)} <button onclick="clearLogo()">×</button></div>`;
    renderComponentsLibrary();
}

function clearLogo() {
    selectedLogo = null;
    document.getElementById('selectedLogo').innerHTML = '';
    renderComponentsLibrary();
}

function useSelectionAsLogo() {
    parent.postMessage({ pluginMessage: { type: 'USE_SELECTION_AS_LOGO' } }, 'https://www.figma.com');
}

// ── Folder tree ──
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

function renderComponentsLibrary() {
    const searchTerm = (componentSearchEl ? componentSearchEl.value : '').toLowerCase().trim();
    const filtered = searchTerm
        ? allComponents.filter(c => (c.name || '').toLowerCase().includes(searchTerm))
        : allComponents;

    if (!filtered.length) {
        componentsLibraryEl.innerHTML = `<div class="components-loading">${searchTerm ? 'Nenhum resultado' : 'Nenhum componente encontrado'}</div>`;
        return;
    }

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

// ── Font selection ──
function selectFont() {
    const value = fontSelectEl.value;
    if (!value) {
        selectedFont = null;
        document.getElementById('selectedFont').innerHTML = '';
    } else {
        const font = allFonts.find(f => f.id === value);
        selectedFont = font;
        document.getElementById('selectedFont').innerHTML =
            `<div class="selected-tag">${esc(font.name)} <button onclick="clearFont()">×</button></div>`;
    }
}

function clearFont() {
    selectedFont = null;
    fontSelectEl.value = '';
    document.getElementById('selectedFont').innerHTML = '';
}

// ── Color selection ──
function toggleColor(colorId, colorName, colorValue) {
    if (selectedColors.has(colorId)) selectedColors.delete(colorId);
    else selectedColors.set(colorId, { name: colorName, value: colorValue });
    updateColorDisplay();
}

function updateColorDisplay() {
    const html = Array.from(selectedColors.values()).map(c =>
        `<div class="selected-tag">` +
        `<span style="display:inline-block;width:10px;height:10px;background:${esc(c.value)};border-radius:2px;margin-right:4px;"></span>` +
        `${esc(c.name)} <button onclick="selectedColors.delete('${Array.from(selectedColors.keys()).find(k => selectedColors.get(k).name === c.name)}'); updateColorDisplay();">×</button></div>`
    ).join('');
    selectedColorsEl.innerHTML = html ? `<div>${html}</div>` : '';
}

// ── Send chat ──
function sendChat() {
    const command = chatInput.value.trim();
    if (!command) return;
    addChatMsg('user', command);
    chatInput.value = '';
    updateSendState();
    showStatus('🤖 Gerando design...', 'loading');

    // Disable input during processing
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
            document.getElementById('selectedLogo').innerHTML =
                `<div class="selected-tag">${esc(msg.component.name)} <button onclick="clearLogo()">×</button></div>`;
            renderComponentsLibrary();
        } else {
            showStatus('Selecione um componente ou instância', 'error');
            setTimeout(hideStatus, 3000);
        }
    } else if (msg.type === 'COMPONENTS_LOADED') {
        hideStatus();
        allComponents = msg.components || [];
        componentsLibraryEl.innerHTML = allComponents.length ? '' : '<div class="components-loading">Nenhum componente encontrado</div>';
        if (allComponents.length) renderComponentsLibrary();
    } else if (msg.type === 'FONT_VARIABLES_LOADED') {
        hideStatus();
        allFonts = msg.fonts || [];
        fontSelectEl.innerHTML = '<option value="">Escolha uma fonte...</option>';
        allFonts.forEach(font => {
            const opt = document.createElement('option');
            opt.value = font.id;
            opt.textContent = font.name;
            fontSelectEl.appendChild(opt);
        });
        fontSelectEl.disabled = false;
    } else if (msg.type === 'COLOR_VARIABLES_LOADED') {
        hideStatus();
        allColors = msg.colors || [];
        colorsList.innerHTML = allColors.map(color =>
            `<label style="display:flex;align-items:center;margin-bottom:6px;cursor:pointer;">` +
            `<input type="checkbox" onchange="toggleColor('${color.id}','${esc(color.name)}','${esc(color.value)}')" style="margin-right:8px;">` +
            `<span style="display:inline-block;width:12px;height:12px;background:${esc(color.value)};border-radius:4px;margin-right:8px;border:1px solid var(--figma-color-border,#e5e5e5);"></span>` +
            `${esc(color.name)}</label>`
        ).join('');
    } else if (msg.type === 'COMPONENT_THUMBNAIL') {
        if (msg.componentId && msg.thumbnail) {
            componentThumbs[msg.componentId] = msg.thumbnail;
            renderComponentsLibrary();
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
    } else if (msg.type === 'CALL_API') {
        showStatus('🔗 Conectando à IA...', 'loading');
        callPluginAPI(msg.context);
    } else if (msg.type === 'OPERATIONS_DONE') {
        hideStatus();
        chatInput.disabled = false;
        updateSendState();
        const countInfo = msg.count ? ` (${msg.count} operações)` : '';
        addChatMsg('assistant', `Design atualizado! ✨${countInfo}`);
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
