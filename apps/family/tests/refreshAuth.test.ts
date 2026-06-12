import { describe, it, expect } from 'vitest';
import { isRefreshAuthorized } from '../src/server/refreshAuth.js';

describe('isRefreshAuthorized', () => {
  it('is open when no token is configured', () => {
    expect(isRefreshAuthorized(undefined, { header: null, query: undefined })).toBe(true);
  });

  it('accepts a matching token via header or query', () => {
    expect(isRefreshAuthorized('s3cret', { header: 's3cret', query: undefined })).toBe(true);
    expect(isRefreshAuthorized('s3cret', { header: null, query: 's3cret' })).toBe(true);
  });

  it('rejects a missing, wrong, or array-valued token', () => {
    expect(isRefreshAuthorized('s3cret', { header: null, query: undefined })).toBe(false);
    expect(isRefreshAuthorized('s3cret', { header: 'nope', query: 'nope' })).toBe(false);
    expect(isRefreshAuthorized('s3cret', { header: null, query: ['s3cret'] })).toBe(false);
  });
});
