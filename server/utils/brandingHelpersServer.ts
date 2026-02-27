export const cleanMarketResearchText = (text: string): string => {
    if (!text) return '';

    // Convert literal \n escape sequences to actual newlines
    let cleaned = text.replace(/\\n/g, '\n');

    // Convert literal \t to actual tabs
    cleaned = cleaned.replace(/\\t/g, '\t');

    // Convert markdown-style bullet points (*   ) to proper bullets
    // Handle both *   and -   patterns
    cleaned = cleaned.replace(/^\s*[\*\-]\s+/gm, '• ');

    // Clean up multiple spaces (but preserve intentional spacing)
    cleaned = cleaned.replace(/[ \t]+/g, ' ');

    // Normalize multiple consecutive newlines to double newlines (paragraph breaks)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Remove leading/trailing whitespace but preserve internal formatting
    cleaned = cleaned.trim();

    return cleaned;
};
