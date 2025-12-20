/**
 * Utility functions for formatting markdown text in a textarea
 */

export interface TextSelection {
  start: number;
  end: number;
  text: string;
}

/**
 * Get the current selection in a textarea element
 */
export const getTextSelection = (textarea: HTMLTextAreaElement): TextSelection | null => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value.substring(start, end);
  
  return {
    start,
    end,
    text,
  };
};

/**
 * Set selection in a textarea element
 */
export const setTextSelection = (
  textarea: HTMLTextAreaElement,
  start: number,
  end: number
): void => {
  textarea.focus();
  textarea.setSelectionRange(start, end);
};

/**
 * Insert text at the current cursor position
 */
export const insertText = (
  textarea: HTMLTextAreaElement,
  textToInsert: string
): void => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  
  const newValue = value.substring(0, start) + textToInsert + value.substring(end);
  textarea.value = newValue;
  
  // Set cursor position after inserted text
  const newCursorPos = start + textToInsert.length;
  setTextSelection(textarea, newCursorPos, newCursorPos);
};

/**
 * Wrap the selected text with markdown formatting
 * Returns the new value and new cursor position
 */
export const wrapSelection = (
  value: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string = prefix
): { newValue: string; newStart: number; newEnd: number } => {
  // If no text is selected, insert the format markers and place cursor between them
  if (start === end) {
    const textToInsert = prefix + suffix;
    const newValue = value.substring(0, start) + textToInsert + value.substring(end);
    const newStart = start + prefix.length;
    const newEnd = newStart;
    return { newValue, newStart, newEnd };
  }
  
  // Wrap selected text
  const selectedText = value.substring(start, end);
  const wrappedText = prefix + selectedText + suffix;
  
  const newValue = value.substring(0, start) + wrappedText + value.substring(end);
  const newStart = start;
  const newEnd = start + wrappedText.length;
  
  return { newValue, newStart, newEnd };
};

/**
 * Apply bold formatting to selected text
 * Returns the new value and cursor position
 */
export const applyBold = (
  value: string,
  start: number,
  end: number
): { newValue: string; newStart: number; newEnd: number } => {
  return wrapSelection(value, start, end, '**', '**');
};

/**
 * Apply italic formatting to selected text
 * Returns the new value and cursor position
 */
export const applyItalic = (
  value: string,
  start: number,
  end: number
): { newValue: string; newStart: number; newEnd: number } => {
  return wrapSelection(value, start, end, '*', '*');
};

/**
 * Insert a bullet point at the current line
 * Returns the new value and cursor position
 */
export const insertBullet = (
  value: string,
  start: number,
  end: number
): { newValue: string; newStart: number; newEnd: number } => {
  // Find the start of the current line
  let lineStart = start;
  while (lineStart > 0 && value[lineStart - 1] !== '\n') {
    lineStart--;
  }
  
  // Check if line already starts with a bullet
  const lineText = value.substring(lineStart, start);
  const trimmedLine = lineText.trim();
  
  if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
    // Already has bullet, just return current values
    return { newValue: value, newStart: start, newEnd: end };
  }
  
  // Insert bullet at the start of the line
  const bullet = '- ';
  const newValue = value.substring(0, lineStart) + bullet + value.substring(lineStart);
  const newStart = start + bullet.length;
  const newEnd = newStart;
  
  return { newValue, newStart, newEnd };
};

/**
 * Apply text color to selected text using a custom format
 * Format: [color:#hex]text[/color]
 * Returns the new value and cursor position
 */
export const applyTextColor = (
  value: string,
  start: number,
  end: number,
  color: string
): { newValue: string; newStart: number; newEnd: number } => {
  // If no text is selected, insert color tags with cursor between them
  if (start === end) {
    const textToInsert = `[color:${color}]` + '[/color]';
    const newValue = value.substring(0, start) + textToInsert + value.substring(end);
    const newStart = start + `[color:${color}]`.length;
    const newEnd = newStart;
    return { newValue, newStart, newEnd };
  }
  
  // Wrap selected text with color tags
  const selectedText = value.substring(start, end);
  const wrappedText = `[color:${color}]${selectedText}[/color]`;
  
  const newValue = value.substring(0, start) + wrappedText + value.substring(end);
  const newStart = start;
  const newEnd = start + wrappedText.length;
  
  return { newValue, newStart, newEnd };
};

/**
 * Convert a color value to hex format if needed
 */
export const normalizeColor = (color: string): string => {
  // Remove # if present
  const cleanColor = color.replace('#', '');
  
  // If it's already hex, return with #
  if (/^[0-9A-Fa-f]{6}$/.test(cleanColor)) {
    return cleanColor;
  }
  
  // Try to convert named colors or other formats
  // For now, just return as-is if it doesn't match hex pattern
  return cleanColor;
};

