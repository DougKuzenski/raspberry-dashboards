import { formatTime } from '../../shared/time.js';
import { useTimeZone } from '../hooks.js';

interface Props {
  stale: boolean;
  lastUpdated: Date | null;
  source?: string;
}

// Small unobtrusive corner indicator. Green dot = fresh, amber = stale/degraded.
export function ConnectionStatus({ stale, lastUpdated, source }: Props) {
  const tz = useTimeZone();
  return (
    <div className={`conn${stale ? ' conn--stale' : ''}`} title={source ? `source: ${source}` : undefined}>
      <span className="conn__dot" />
      <span>
        {stale ? 'Data stale' : 'Live'}
        {lastUpdated ? ` · ${formatTime(lastUpdated.toISOString(), tz)}` : ''}
      </span>
    </div>
  );
}
