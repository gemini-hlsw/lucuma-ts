/**
 * Main page component for the Tonight feature, displaying the telescope night timeline.
 */
import type { JSX } from 'react';
import { useState } from 'react';

import { useTelescopeNightTimeline } from '../../gql/telescope';
import { toTimelineRows } from './adapters';
import { Header } from './Header';
import type { TimelineTimeDisplay } from './time';
import { Timeline } from './Timeline';
import type { TimelineBlock } from './types';

export default function TonightPage(): JSX.Element {
  const SITE = 'GN';
  const DATE = '2026-08-01';

  const [timeDisplay, setTimeDisplay] = useState<TimelineTimeDisplay>('site');

  const { data, loading, error } = useTelescopeNightTimeline(SITE, DATE);

  if (loading) {
    return <p className="p-4 text-sm text-foreground-secondary">Loading...</p>;
  }

  if (error) {
    return <p className="p-4 text-sm text-red-400">Error: {error.message}</p>;
  }

  const timeline = data?.telescopeNightTimeline;

  if (!timeline) {
    return <p className="p-4 text-sm text-foreground">No data found.</p>;
  }

  const rows = toTimelineRows(timeline);

  const handleBlockSelect = (block: TimelineBlock): void => {
    console.log('Selected timeline block:', block);
  };

  return (
    <section>
      <Header timeline={timeline} timeDisplay={timeDisplay} onTimeDisplayChange={setTimeDisplay} />

      <Timeline
        site={timeline.site}
        timeDisplay={timeDisplay}
        displayInterval={timeline.displayInterval}
        rows={rows}
        onBlockSelect={handleBlockSelect}
      />
    </section>
  );
}
