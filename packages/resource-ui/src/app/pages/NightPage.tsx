import { when } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';

import { useClockPreference } from '@/app/useClockPreference';
import { nightBoundaries, useNow } from '@/app/useNow';
import { useSelection } from '@/app/useSelection';
import { NightStepper } from '@/components/ui/NightStepper';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyPanel, ErrorAlert, Loading } from '@/components/ui/PageStatus';
import { toApiInterval } from '@/domain/adapters';
import { contains } from '@/domain/interval';
import { buildNightTimeline } from '@/domain/nightTimeline';
import { addDays } from '@/domain/semester';
import { observingNightInterval } from '@/domain/siteTime';
import { buildNightChartOptions, clockLabel } from '@/features/night/nightChartOptions';
import { TimelineChart, TimelineLegendBar } from '@/features/timeline/TimelineChart';
import {
  calendarLegendExtras,
  modeLegendExtras,
  telescopeLegendExtras,
  tooLegendExtras,
} from '@/features/timeline/timelineOptions';
import { useNightSchedule } from '@/gql/hooks';

/** The view the rest of the model exists for: a run changing mid-night is drawn where it changes. */
export default function NightPage(): JSX.Element {
  const { site, observingNight, tonight, setObservingNight, clearObservingNight } = useSelection();
  const timeDisplay = useClockPreference();
  const now = useNow(nightBoundaries(site));

  const interval = observingNightInterval(site, observingNight);

  const {
    instrumentAvailability,
    telescopeAvailability,
    tooSupport,
    telescopeMode,
    telescopeSubsystemAvailability,
    loading,
    error,
    dataAvailable,
  } = useNightSchedule(site, observingNight, toApiInterval(interval));

  const night = buildNightTimeline({
    site,
    observingNight,
    instrumentAvailability,
    telescopeAvailability,
    tooSupport,
    telescopeMode,
    telescopeSubsystemAvailability,
  });

  const options = buildNightChartOptions({ night, site, timeDisplay });

  return (
    <div className="min-w-0">
      <PageHeader
        title={`Night of ${observingNight}`}
        actions={
          <NightStepper
            value={observingNight}
            onChange={setObservingNight}
            onStep={(days) => {
              setObservingNight(addDays(observingNight, days));
            }}
            step={1}
            dateLabel="Observing night"
            stepLabel="night"
            onTonight={clearObservingNight}
            isTonight={observingNight === tonight}
          />
        }
      />

      {when(error, (error) => (
        <ErrorAlert what="the night" error={error} />
      ))}

      {loading && <Loading what="the night" />}

      {!loading && dataAvailable === false && (
        // I4: absence is "not recorded", never "unavailable", which is why the flag is asked for.
        <EmptyPanel>Nothing is recorded for this night. That is not the same as nothing being available.</EmptyPanel>
      )}

      {/* Three answers, not two: `undefined` is the errored query, so `!== false` would draw an empty chart. */}
      {!loading && dataAvailable === true && (
        <>
          <TimelineLegendBar
            legend={night}
            telescope={telescopeLegendExtras(telescopeAvailability)}
            mode={modeLegendExtras(telescopeMode)}
            too={tooLegendExtras(tooSupport)}
            calendar={calendarLegendExtras({
              now: contains(interval, now) && 'Now',
            })}
          />
          {night.transitions.length > 0 && (
            <p className="mb-3 text-xs text-foreground-secondary">
              Changes during the night at{' '}
              {night.transitions.map((instant) => clockLabel(instant, site, timeDisplay)).join(', ')}.
            </p>
          )}
          <TimelineChart
            options={options}
            continuesLabel="continues beyond tonight"
            label={`Night of ${observingNight}`}
            testId="night-timeline"
          />
        </>
      )}
    </div>
  );
}
