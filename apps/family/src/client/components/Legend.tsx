import type { CalSource } from '../../shared/types.js';

// One entry per calendar lane. A source that failed to load in the current
// payload is greyed and labeled, so an incomplete lane never masquerades as a
// free week.
export function Legend({ sources }: { sources: CalSource[] }) {
  return (
    <div className="legend">
      {sources.map((s) => (
        <span key={s.id} className={`legend__item${s.failed ? ' legend__item--failed' : ''}`}>
          <span className="legend__dot" style={{ background: s.color }} />
          {s.label}
          {s.failed && ' — unavailable'}
        </span>
      ))}
    </div>
  );
}
