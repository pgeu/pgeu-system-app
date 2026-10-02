/**
 * Log Redaction Utilities
 * Strips credentials from strings before they are written to the console
 */

/**
 * Matches pgeu-system tokens: scanner tokens in check-in/sponsor URLs and
 * attendee tokens in badge QR codes are all 40-64 hex characters
 */
const TOKEN_PATTERN = /\b[a-f0-9]{40,64}\b/gi;

/**
 * Replaces any pgeu-system token in the text with a placeholder, so URLs and
 * scanned values can be logged without exposing credentials
 * @param text - The text to redact
 * @returns The text with tokens replaced by "[redacted]"
 */
export function redactTokens(text: string): string {
  return text.replace(TOKEN_PATTERN, '[redacted]');
}
