import { describe, it, expect } from 'vitest';
import { validateManualFile, DataValidationError } from '../src/server/providers/validate.js';

const good = {
  timezone: 'America/Los_Angeles',
  sources: [{ id: 'family', label: 'Family', color: '#2dd4bf' }],
  events: [{ id: 'e1', source: 'family', title: 'Thing', allDay: false, start: '2026-06-12T16:00:00Z' }],
};

describe('validateManualFile', () => {
  it('accepts a well-formed file', () => {
    expect(validateManualFile(good).events).toHaveLength(1);
  });

  it('rejects an event whose source is not defined', () => {
    const bad = { ...good, events: [{ id: 'e1', source: 'nope', title: 'x', allDay: false, start: '2026-06-12T16:00:00Z' }] };
    expect(() => validateManualFile(bad)).toThrow(DataValidationError);
  });

  it('requires a date on an all-day event and a start on a timed event', () => {
    const noDate = { ...good, events: [{ id: 'e', source: 'family', title: 'x', allDay: true }] };
    const noStart = { ...good, events: [{ id: 'e', source: 'family', title: 'x', allDay: false }] };
    expect(() => validateManualFile(noDate)).toThrow(/all-day/);
    expect(() => validateManualFile(noStart)).toThrow(/timed/);
  });

  it('rejects an empty sources list', () => {
    expect(() => validateManualFile({ ...good, sources: [] })).toThrow(DataValidationError);
  });
});
