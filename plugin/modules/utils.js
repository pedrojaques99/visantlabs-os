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
