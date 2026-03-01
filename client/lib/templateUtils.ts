/**
 * Normalizes template component values (header, body, footer) into a string.
 * Handles both flat strings (legacy) and structured objects (current).
 * 
 * @param {string|object} value - The template component value to normalize
 * @returns {string} The extracted text content
 */
export const normalizeTemplateText = (value) => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  // Handle structured objects with .text, .content, or .value
  if (typeof value.text === 'string') return value.text;
  if (typeof value.content === 'string') return value.content;
  if (typeof value.value === 'string') return value.value;

  // Fallback for objects that might be just { enabled: true, text: "..." }
  // but don't match the above checks for some reason
  return '';
};

/**
 * Extracts variables from template text (e.g., {{1}}, {{2}}).
 * 
 * @param {string} text - The text to extract variables from
 * @returns {number[]} Array of variable numbers found
 */
export const extractVariables = (text) => {
  if (typeof text !== 'string') return [];
  const regex = /\{\{(\d+)\}\}/g;
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const num = parseInt(match[1]);
    if (!matches.includes(num)) {
      matches.push(num);
    }
  }
  return matches.sort((a, b) => a - b);
};
