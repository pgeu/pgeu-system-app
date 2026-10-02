import { describe, it, expect } from 'vitest';
import { redactTokens } from './redact';

const TOKEN = 'a'.repeat(40);
const LONG_TOKEN = '0123456789abcdef'.repeat(4);

describe('redact', () => {
  describe('redactTokens', () => {
    it('should redact the token in a check-in API URL', () => {
      expect(redactTokens(`https://example.com/events/pgconf/checkin/${TOKEN}/api/status/`))
        .toBe('https://example.com/events/pgconf/checkin/[redacted]/api/status/');
    });

    it('should redact the token in a sponsor scanning URL', () => {
      expect(redactTokens(`https://example.com/events/sponsor/scanning/${LONG_TOKEN}/api/lookup/`))
        .toBe('https://example.com/events/sponsor/scanning/[redacted]/api/lookup/');
    });

    it('should redact tokens in simple-format QR codes', () => {
      expect(redactTokens(`ID$${TOKEN}$ID`)).toBe('ID$[redacted]$ID');
      expect(redactTokens(`AT$${TOKEN.toUpperCase()}$AT`)).toBe('AT$[redacted]$AT');
    });

    it('should redact tokens in URL-format QR codes', () => {
      expect(redactTokens(`https://example.com/t/id/${TOKEN}/`))
        .toBe('https://example.com/t/id/[redacted]/');
    });

    it('should redact every token in the text', () => {
      expect(redactTokens(`${TOKEN} and ${LONG_TOKEN}`)).toBe('[redacted] and [redacted]');
    });

    it('should leave text without tokens unchanged', () => {
      expect(redactTokens('https://example.com/events/pgconf/')).toBe('https://example.com/events/pgconf/');
      expect(redactTokens('a'.repeat(39))).toBe('a'.repeat(39));
    });
  });
});
