import type { CalEvent, CalSource } from '../../shared/types.js';
import { formatTime, formatCountdown, civilLabel, zonedDayLabel } from '../../shared/time.js';
import { useTimeZone } from '../hooks.js';
import { colorOf } from './colorOf.js';

interface Props {
  live?: CalEvent;
  next?: CalEvent;
  sources: CalSource[];
  now: Date;
}

// The hero strip: what's happening right now, and what's on deck.
export function NowNext({ live, next, sources, now }: Props) {
  const tz = useTimeZone();
  return (
    <div className="hero">
      {live ? (
        <div className="card card--now" style={{ ['--accent' as string]: colorOf(sources, live.source) }}>
          <div className="card__eyebrow"><span className="pulse" />HAPPENING NOW</div>
          <div className="card__title">{live.title}</div>
          <div className="card__meta">
            until {formatTime(live.end ?? live.start!, tz)}{live.location ? ` · ${live.location}` : ''}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card__eyebrow">NOTHING ON RIGHT NOW</div>
          <div className="card__title">Free until the next thing</div>
          <div className="card__meta">enjoy it</div>
        </div>
      )}
      {next ? (
        <div className="card" style={{ ['--accent' as string]: colorOf(sources, next.source) }}>
          <div className="card__eyebrow">UP NEXT</div>
          <div className="card__title">{next.title}</div>
          <div className="card__meta">{nextWhen(next, now, tz)}{next.location ? ` · ${next.location}` : ''}</div>
        </div>
      ) : (
        <div className="card card--empty"><div className="card__title">Nothing else scheduled</div></div>
      )}
    </div>
  );
}

function nextWhen(e: CalEvent, now: Date, tz: string): string {
  if (e.allDay) return `${civilLabel(e.date!)} · all day`;
  const countdown = formatCountdown(e.start!, now);
  // zonedDayLabel, not a string slice: the start's offset form varies by provider.
  return `${zonedDayLabel(e.start!, tz)} · ${formatTime(e.start!, tz)}${countdown ? ` · in ${countdown}` : ''}`;
}
