import { useDashboardFeed, useNow, useFitScale, TimeZoneProvider } from './hooks.js';
import { selectCalendarState } from '../shared/selectCalendarState.js';
import { civilLabel } from '../shared/time.js';
import { BASE_W, BASE_H, DEFAULT_TIMEZONE } from '../shared/constants.js';
import { Header } from './components/Header.js';
import { Legend } from './components/Legend.js';
import { NowNext } from './components/NowNext.js';
import { AllDayBanner } from './components/AllDayBanner.js';
import { TodayPanel } from './components/TodayPanel.js';
import { WeekPanel } from './components/WeekPanel.js';
import { FooterTicker } from './components/FooterTicker.js';
import { ConnectionStatus } from './components/ConnectionStatus.js';

// Subtle anti-burn-in nudge: shift the canvas a few px on a slow cycle so static
// text never sits on the exact same pixels all day.
function burnInOffset(now: Date): { x: number; y: number } {
  const step = Math.floor(now.getTime() / (10 * 60 * 1000));
  return [{ x: 0, y: 0 }, { x: 6, y: 4 }, { x: -6, y: 6 }, { x: 4, y: -4 }][step % 4];
}

export function App() {
  const { data, stale, lastUpdated } = useDashboardFeed();
  const now = useNow();
  const scale = useFitScale(BASE_W, BASE_H);

  if (!data) {
    return (
      <div className="viewport" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="loading-text">Loading family dashboard…</div>
      </div>
    );
  }

  const tz = data.timezone || DEFAULT_TIMEZONE;
  const view = selectCalendarState(data, now, tz);
  const offset = burnInOffset(now);
  // Degraded (a source failed) reads as stale too: the lane gap is visible in
  // the legend, and the corner dot goes amber instead of pretending all is well.
  const isStale = stale || Boolean(data.stale) || Boolean(data.degraded);
  const transform = `translate(-50%, -50%) scale(${scale}) translate(${offset.x}px, ${offset.y}px)`;

  const weekLabel = view.weekDays.length
    ? `${civilLabel(view.todayKey)} – ${civilLabel(view.weekDays[view.weekDays.length - 1].key)}`
    : 'This week';

  return (
    <TimeZoneProvider value={tz}>
      <div className="viewport">
        <div className="board" style={{ transform }}>
          <div className="board__topline">
            <Header now={now} weekLabel={weekLabel} />
          </div>
          <Legend sources={view.sources} />
          <NowNext live={view.liveEvent} next={view.upNext} sources={view.sources} now={now} />
          <AllDayBanner events={view.allDayBanner} sources={view.sources} />
          <main className="board__body">
            <TodayPanel events={view.todayEvents} sources={view.sources} now={now} />
            <WeekPanel weekDays={view.weekDays} sources={view.sources} todayKey={view.todayKey} now={now} />
          </main>
          <FooterTicker view={view} />
          <ConnectionStatus stale={isStale} lastUpdated={lastUpdated} source={data.source} />
        </div>
      </div>
    </TimeZoneProvider>
  );
}
