/**
 * Shared utilities for plugin UI modules
 * Best practice: DRY — single source for common functions
 */

/**
 * Escape HTML to prevent XSS in dynamically generated content
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    return (text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Trigger file download directly from UI
 * @param {Object} obj JSON serializable object
 * @param {string} filename Output file name
 */
function downloadJSON(obj, filename) {
    const data = JSON.stringify(obj, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
