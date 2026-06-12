import { useDashboardFeed, useNow, useFitScale } from './hooks.js';
import { selectDashboardState } from '../shared/selectDashboardState.js';
import { Header } from './components/Header.js';
import { HeroMatchCard } from './components/HeroMatchCard.js';
import { TodayMatches } from './components/TodayMatches.js';
import { UpcomingMatches } from './components/UpcomingMatches.js';
import { GroupStandings } from './components/GroupStandings.js';
import { BracketView } from './components/BracketView.js';
import { FooterTicker } from './components/FooterTicker.js';
import { ConnectionStatus } from './components/ConnectionStatus.js';

// Subtle anti-burn-in nudge: shift the whole canvas by a few pixels on a slow
// cycle so static text never sits on the exact same pixels all day (spec §6/§7).
function burnInOffset(now: Date): { x: number; y: number } {
  const step = Math.floor(now.getTime() / (10 * 60 * 1000)); // changes every 10 min
  const positions = [
    { x: 0, y: 0 },
    { x: 6, y: 4 },
    { x: -6, y: 6 },
    { x: 4, y: -4 },
  ];
  return positions[step % positions.length];
}

// Fixed design canvas; the whole dashboard scales to fit the screen.
const BASE_W = 1280;
const BASE_H = 720;

export function App() {
  const { data, stale, lastUpdated } = useDashboardFeed();
  const now = useNow();
  const scale = useFitScale(BASE_W, BASE_H);

  if (!data) {
    return (
      <div className="viewport" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="loading-text">Loading World Cup dashboard…</div>
      </div>
    );
  }

  const view = selectDashboardState(data, now);
  const offset = burnInOffset(now);
  const isStale = stale || Boolean(data.stale);

  // Center, scale to fit, then apply the subtle burn-in nudge (in design px).
  const transform =
    `translate(-50%, -50%) scale(${scale}) translate(${offset.x}px, ${offset.y}px)`;

  return (
    <div className="viewport">
      <div className="dashboard" style={{ transform }}>
      <Header
        phase={data.tournamentPhase}
        now={now}
        liveCount={view.liveMatches.length}
      />

      <main className="dashboard__body">
        <section className="dashboard__hero">
          <HeroMatchCard match={view.heroMatch} now={now} />
        </section>

        <section className="dashboard__today">
          <TodayMatches matches={view.todayMatches} now={now} />
        </section>

        <section className="dashboard__context">
          {view.showBracket ? (
            <BracketView nodes={data.bracket} />
          ) : (
            <GroupStandings standings={data.standings} featuredGroup={view.featuredGroup} />
          )}
        </section>
      </main>

      <UpcomingMatches matches={view.upcomingMatches} now={now} />

      <FooterTicker
        upcoming={view.upcomingMatches}
        recent={view.recentResults}
        message={data.manualMessage}
        now={now}
      />

      <ConnectionStatus stale={isStale} lastUpdated={lastUpdated} source={data.source} />
      </div>
    </div>
  );
}
