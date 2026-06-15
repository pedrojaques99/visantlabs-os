import { describe, it, expect } from 'vitest';
import { stripDataUriPrefix } from '../../../../server/lib/dataUri.js';

// Unit tests for stripDataUriPrefix — replaces the narrow
// /^data:image\/\w+;base64,/ pattern that missed MIME types with non-word
// characters (image/svg+xml) and uppercase schemes.

describe('stripDataUriPrefix', () => {
  it('strips a standard png data-uri prefix', () => {
    expect(stripDataUriPrefix('data:image/png;base64,AAAA')).toBe('AAAA');
  });

  it('strips a MIME type containing a "+" (image/svg+xml)', () => {
    expect(stripDataUriPrefix('data:image/svg+xml;base64,PHN2Zz4=')).toBe('PHN2Zz4=');
  });

  it('strips non-image MIME types (application/pdf)', () => {
    expect(stripDataUriPrefix('data:application/pdf;base64,JVBER')).toBe('JVBER');
  });

  it('is case-insensitive on the scheme/base64 token', () => {
    expect(stripDataUriPrefix('DATA:image/png;BASE64,AAAA')).toBe('AAAA');
  });

  it('returns already-bare base64 unchanged', () => {
    expect(stripDataUriPrefix('AAAAbbbbCCCC==')).toBe('AAAAbbbbCCCC==');
  });

  it('only strips the leading prefix, not embedded text', () => {
    expect(stripDataUriPrefix('AAAdata:image/png;base64,BBB')).toBe('AAAdata:image/png;base64,BBB');
  });
});
