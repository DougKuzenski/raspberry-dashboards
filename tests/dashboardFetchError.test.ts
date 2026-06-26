import { describe, expect, it } from 'vitest';
import { dashboardFetchErrorMessage } from '../src/client/hooks.js';

describe('dashboardFetchErrorMessage', () => {
  it('preserves concrete HTTP status messages', () => {
    expect(dashboardFetchErrorMessage(new Error('HTTP 404'))).toBe('HTTP 404');
  });

  it('falls back for non-Error failures', () => {
    expect(dashboardFetchErrorMessage('network down')).toBe('Unable to load dashboard data');
  });
});
