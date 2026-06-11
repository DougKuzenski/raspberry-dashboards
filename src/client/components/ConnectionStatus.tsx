import { formatHeaderClock } from '../../shared/time.js';

interface Props {
  stale: boolean;
  lastUpdated: Date | null;
  source?: string;
}

// Small unobtrusive corner indicator. Green dot = fresh, amber = stale/fallback
// (spec §11: keep showing last good data, show a small "data stale" indicator).
export function ConnectionStatus({ stale, lastUpdated, source }: Props) {
  return (
    <div className={`conn${stale ? ' conn--stale' : ''}`} title={source ? `source: ${source}` : undefined}>
      <span className="conn__dot" />
      <span className="conn__text">
        {stale ? 'Data stale' : 'Live'}
        {lastUpdated && ` · ${formatHeaderClock(lastUpdated)}`}
      </span>
    </div>
  );
}
