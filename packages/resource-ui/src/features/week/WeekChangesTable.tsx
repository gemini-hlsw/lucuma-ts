import { when } from '@gemini-hlsw/lucuma-common-ui';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import type { JSX } from 'react';

import { EmptyPanel } from '@/components/ui/PageStatus';
import { displayTimeZone, type TimeDisplay, zoneFormatters } from '@/domain/siteTime';
import type { Site } from '@/domain/types';
import type { WeekChange } from '@/domain/weekChanges';
import { LOCATION_LABEL } from '@/features/components/componentLabels';
import { INSTRUMENT_LABEL } from '@/features/timeline/instruments';

const whenFormat = zoneFormatters('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const whenLabel = (instant: number, site: Site, display: TimeDisplay): string =>
  whenFormat(displayTimeZone(site, display)).format(new Date(instant));

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
        change.location === 'INSTALLED' ? 'installed' : `to ${LOCATION_LABEL[change.location]}`
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
        <EmptyPanel>Nothing changes this week - every run carries straight through.</EmptyPanel>
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
                    <span className="text-xs text-foreground-secondary italic">{note}</span>
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
