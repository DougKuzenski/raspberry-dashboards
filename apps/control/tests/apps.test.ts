import { describe, it, expect } from 'vitest';
import { isKnownApp, resolveActive, APPS } from '../src/server/apps.js';

describe('isKnownApp', () => {
  it('accepts registered apps and rejects everything else', () => {
    expect(isKnownApp('worldcup')).toBe(true);
    expect(isKnownApp('family')).toBe(true);
    expect(isKnownApp('nope')).toBe(false);
    expect(isKnownApp('')).toBe(false);
    expect(isKnownApp(undefined)).toBe(false);
    expect(isKnownApp(42)).toBe(false);
  });
});

describe('resolveActive', () => {
  it('prefers a valid override over the manifest', () => {
    expect(resolveActive('family', '{"active":"worldcup"}')).toBe('family');
  });

  it('trims and tolerates a trailing newline in the override file', () => {
    expect(resolveActive('family\n', '{"active":"worldcup"}')).toBe('family');
  });

  it('falls back to the manifest when there is no override', () => {
    expect(resolveActive(null, '{"active":"family"}')).toBe('family');
  });

  it('ignores an invalid override and uses the manifest', () => {
    expect(resolveActive('bogus', '{"active":"family"}')).toBe('family');
  });

  it('defaults to the first app when override and manifest are unusable', () => {
    expect(resolveActive(null, null)).toBe(APPS[0].id);
    expect(resolveActive('', 'not json')).toBe(APPS[0].id);
    expect(resolveActive(null, '{"active":"ghost"}')).toBe(APPS[0].id);
  });
});
