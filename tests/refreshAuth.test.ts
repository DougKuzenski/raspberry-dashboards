import { describe, it, expect } from 'vitest';
import { isRefreshAuthorized } from '../src/server/refreshAuth.js';

describe('isRefreshAuthorized', () => {
  it('is open when no token is configured', () => {
    expect(isRefreshAuthorized(undefined, { header: null, query: undefined })).toBe(true);
    expect(isRefreshAuthorized('', { header: 'anything', query: 'anything' })).toBe(true);
  });

  it('accepts a matching token via header or query', () => {
    expect(isRefreshAuthorized('s3cret', { header: 's3cret', query: undefined })).toBe(true);
    expect(isRefreshAuthorized('s3cret', { header: null, query: 's3cret' })).toBe(true);
  });

  it('rejects a missing or wrong token when one is configured', () => {
    expect(isRefreshAuthorized('s3cret', { header: null, query: undefined })).toBe(false);
    expect(isRefreshAuthorized('s3cret', { header: 'nope', query: 'nope' })).toBe(false);
    // A query param can arrive as an array (?token=a&token=b) — must not match.
    expect(isRefreshAuthorized('s3cret', { header: null, query: ['s3cret'] })).toBe(false);
  });
});
