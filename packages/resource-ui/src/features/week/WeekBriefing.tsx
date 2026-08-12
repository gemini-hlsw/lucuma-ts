/**
 * The week briefing: the facts strip and the changes list under the chart.
 *
 * The chart shows the runs; these two show what makes this week different from
 * any other - the sky per night, and every boundary that falls inside the
 * window. Plain cards and a plain DataTable, per the standing preference for
 * simple standard UI. Each card is also the way into its night: every
 * night-shaped thing opens the night view, as the calendar squares do.
 */
import { cn, when } from '@gemini-hlsw/lucuma-common-ui';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Tag } from 'primereact/tag';
import type { JSX } from 'react';

import { useOpenNight } from '@/app/useOpenNight';
import { displayTimeZone, type TimeDisplay, zoneFormatters } from '@/domain/siteTime';
import type { Site } from '@/domain/types';
import type { WeekChange, WeekNightFacts } from '@/domain/weekBriefing';
import { MoonDisc } from '@/features/calendar/MoonDisc';
import { PLACE_LABEL } from '@/features/components/componentLabels';
import { INSTRUMENT_LABEL } from '@/features/timeline/timelineOptions';

const EVENING_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** "Sat 21 Nov" - the evening a night begins, matching the chart's axis. */
const eveningLabel = (isoDate: string): string => EVENING_FORMAT.format(new Date(`${isoDate}T12:00:00Z`));

const whenFormat = zoneFormatters('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "Sun 22 Nov, 10:00" - the instant's wall-clock date in the chosen clock. */
const whenLabel = (instant: number, site: Site, display: TimeDisplay): string =>
  whenFormat(displayTimeZone(site, display)).format(new Date(instant));

export function WeekNightStrip({ facts }: { facts: readonly WeekNightFacts[] }): JSX.Element {
  const openNight = useOpenNight();

  return (
    <section aria-label="Nights at a glance" className="mt-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {facts.map((fact) => (
          <button
            key={fact.observingNight}
            type="button"
            data-testid="week-night-facts"
            aria-label={`Open night beginning ${fact.eveningDate}`}
            className="cursor-pointer rounded border border-subtle bg-surface p-2 text-left text-xs transition-colors hover:bg-surface-raised/40"
            onClick={() => {
              openNight(fact.observingNight);
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={cn('font-semibold', fact.isHoliday ? 'text-amber-400' : 'text-foreground')}>
                {eveningLabel(fact.eveningDate)}
              </span>
              <MoonDisc phase={fact.moon} size={14} />
            </div>
            <div className="mt-1 text-foreground-secondary">
              {fact.darkHours === null ? 'No astronomical night' : `${fact.darkHours.toFixed(1)} h dark`}
            </div>
            <div className="text-foreground-muted">{Math.round(fact.moon.fraction * 100)}% moon</div>
            {(fact.publishedMoon !== null || fact.isHoliday || !fact.dataAvailable) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {when(fact.publishedMoon, (publishedMoon) => (
                  <Tag value={publishedMoon === 'NEW' ? 'new moon' : 'full moon'} className="!text-[0.6rem]" />
                ))}
                {fact.isHoliday && <Tag value="holiday" severity="warning" className="!text-[0.6rem]" />}
                {!fact.dataAvailable && <Tag value="not recorded" severity="secondary" className="!text-[0.6rem]" />}
              </div>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

const whatLabel = (change: WeekChange): string => {
  switch (change.kind) {
    case 'RUN_BEGINS':
      return `${change.label} begins`;
    case 'RUN_ENDS':
      return `${change.label} ends`;
    case 'CLOSURE_BEGINS':
      return `${change.label} begins`;
    case 'CLOSURE_ENDS':
      return `${change.label} ends`;
    default:
      return `${change.component.name} ${
        change.place === 'INSTALLED' ? 'installed' : `to ${PLACE_LABEL[change.place]}`
      }`;
  }
};

const whereLabel = (change: WeekChange): string => {
  switch (change.kind) {
    case 'COMPONENT':
      return INSTRUMENT_LABEL[change.component.instrument];
    case 'CLOSURE_BEGINS':
    case 'CLOSURE_ENDS':
      return change.rowLabel ?? 'Telescope';
    default:
      return change.rowLabel;
  }
};

const noteOf = (change: WeekChange): string | null =>
  change.kind === 'RUN_BEGINS' || change.kind === 'COMPONENT' ? change.note : null;

export function WeekChangesTable({
  changes,
  site,
  timeDisplay,
}: {
  changes: readonly WeekChange[];
  site: Site;
  timeDisplay: TimeDisplay;
}): JSX.Element {
  return (
    <section aria-label="Changes this week" className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-foreground">Changes this week</h2>

      {changes.length === 0 ? (
        <p className="rounded border border-subtle bg-surface p-3 text-sm text-foreground-secondary">
          Nothing changes this week - every run carries straight through.
        </p>
      ) : (
        <DataTable value={[...changes]} size="small" stripedRows data-testid="week-changes">
          <Column
            header="When"
            body={(change: WeekChange) => (
              <span className="text-foreground-secondary tabular-nums">
                {whenLabel(change.instant, site, timeDisplay)}
              </span>
            )}
          />
          <Column
            header="What"
            body={(change: WeekChange) => {
              const note = noteOf(change);
              return (
                <span className="flex flex-col">
                  <span className="font-medium text-foreground">{whatLabel(change)}</span>
                  {when(note === whatLabel(change) ? null : note, (note) => (
                    <span className="text-[0.65rem] text-foreground-muted italic">{note}</span>
                  ))}
                </span>
              );
            }}
          />
          <Column header="Where" body={(change: WeekChange) => whereLabel(change)} />
        </DataTable>
      )}
    </section>
  );
}
