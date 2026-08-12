/**
 * The instrument browser - where is every instrument, tonight.
 *
 * The other half of the finder pair. `/components` answers "where is the R400
 * grating"; this answers "where is GNIRS", which the schedule views cannot: they
 * are the ports' picture, so an instrument recorded usable between mounts has no
 * port and therefore no row there (Dan, 2026-08-12).
 *
 * Same shape as the component browser on purpose - one plain DataTable, the
 * night from the URL, client-side search over a catalog already in hand - so the
 * two read as one tool rather than two.
 */
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { type JSX, useState } from 'react';

import { useSelection } from '@/app/useSelection';
import { useSemester } from '@/app/useSemester';
import { useSiteSpan } from '@/app/useSiteSpan';
import { useUrlParam } from '@/app/useUrlParam';
import { NoteCell } from '@/components/ui/NoteCell';
import { RecordHistoryTable } from '@/components/ui/RecordHistoryTable';
import { type RecordStatus, StatusTag } from '@/components/ui/StatusTag';
import { SyntheticDataTag } from '@/components/ui/SyntheticDataTag';
import {
  buildInstrumentRows,
  type InstrumentRow,
  locationLabel,
  locationOptions,
  matchesInstrument,
  mountingLocationLabel,
  runsOf,
} from '@/domain/instrumentFinder';
import { firstEveningDate, lastEveningDate, nightCount, observingNightInterval } from '@/domain/siteTime';
import { USAGE_LABEL } from '@/domain/timeline';
import type { Mounting, ResourceUsage, Site } from '@/domain/types';
import { INSTRUMENT_LABEL, instrumentColor } from '@/features/timeline/timelineOptions';
import { useSemesterSchedule } from '@/gql/hooks';

const EVENING_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const printEvening = (eveningDate: string): string => EVENING_FORMAT.format(new Date(`${eveningDate}T12:00:00Z`));

/**
 * How a run's usability reads, in the row and in the expansion alike - one
 * function so a run cannot wear one status in the table and another under it.
 */
const usageStatus = (usage: ResourceUsage): RecordStatus => ({
  label: USAGE_LABEL[usage],
  severity: usage === 'SCIENCE' ? 'success' : usage === 'ENGINEERING' ? 'info' : 'danger',
  tone: usage === 'UNAVAILABLE' ? 'alert' : 'normal',
});

/**
 * The expansion: every run over the site's record, in evening dates, with how
 * many nights each lasted - a run list is read for its lengths, and the count
 * is already in the interval the query returns.
 */
function Runs({ runs, site }: { runs: readonly Mounting[]; site: Site }): JSX.Element {
  const rows = runs.map((run) => ({
    id: run.id,
    dates: `${printEvening(firstEveningDate(site, run.interval))} – ${printEvening(lastEveningDate(site, run.interval))}`,
    nights: nightCount(site, run.interval),
    where: mountingLocationLabel(run),
    status: usageStatus(run.usage),
    note: run.note,
  }));

  return (
    <RecordHistoryTable
      rows={rows}
      whereHeader="Where"
      ariaLabel="Instrument runs"
      testId="instrument-runs"
      emptyMessage="No runs recorded for this instrument."
    />
  );
}

export default function InstrumentsPage(): JSX.Element {
  const { site, observingNight } = useSelection();
  const { semester: selected, loading: loadingSets, error: setsError } = useSemester();
  const [search, setSearch] = useUrlParam('q', '', { replace: true });
  const [location, setLocation] = useUrlParam('location', '', { replace: true });
  const [expanded, setExpanded] = useState<InstrumentRow[]>([]);

  const activeSite = selected?.site ?? site;

  // The site's whole recorded span, not the selected semester - see
  // `app/useSiteSpan.ts`. Site assignment is time-bounded operational data
  // carried by the availability blocks (v1-domain-model.md §5.1), so the site's
  // instruments are exactly the ones its records have ever named.
  const bounds = useSiteSpan();

  const { mountings, loading, error } = useSemesterSchedule(activeSite, bounds);

  const night = observingNightInterval(activeSite, observingNight);
  const rows = buildInstrumentRows({ mountings, night });
  const locations = locationOptions(rows);
  // Sorted by the name on screen, not the enum tag behind it: CAL_ZORRO reads
  // "Zorro", and a list alphabetised by a tag the reader cannot see looks
  // unsorted.
  const visible = rows
    .filter((row) => matchesInstrument(row, search) && (location === '' || locationLabel(row) === location))
    .sort((a, b) => INSTRUMENT_LABEL[a.instrument].localeCompare(INSTRUMENT_LABEL[b.instrument]));

  const onTelescope = rows.filter((row) => row.where.kind === 'PORT').length;
  const failure = setsError ?? error;

  return (
    <div className="min-w-0">
      <header className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">Instruments</h1>
            {selected?.demo === true && <SyntheticDataTag />}
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            Every instrument {activeSite} has ever recorded, and where it is on the night of{' '}
            {printEvening(firstEveningDate(activeSite, night))}. {onTelescope} of {rows.length} on the telescope. Open a
            row for its runs.
          </p>
        </div>
      </header>

      {failure !== undefined && (
        <p role="alert" className="mb-4 rounded border border-red-700/60 bg-red-900/30 p-3 text-sm text-red-100">
          Could not load the instruments: {failure.message}
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          Search
          <InputText
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Instrument or published name"
            aria-label="Search instruments"
            className="w-72"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          Location
          <Dropdown
            value={locations.some((entry) => entry.label === location) ? location : null}
            options={locations.map((entry) => ({
              label: `${entry.label} (${String(entry.count)})`,
              value: entry.label,
            }))}
            onChange={(event) => {
              setLocation((event.value as string | undefined) ?? '');
            }}
            showClear
            placeholder="Anywhere"
            aria-label="Location"
            className="w-56"
          />
        </label>
      </div>

      {(loading || loadingSets) && <p className="text-sm text-foreground-muted">Loading the instruments…</p>}

      {!loading && !loadingSets && (
        <DataTable
          value={[...visible]}
          dataKey="instrument"
          expandedRows={expanded}
          onRowToggle={(event) => {
            setExpanded(event.data as InstrumentRow[]);
          }}
          rowExpansionTemplate={(row: InstrumentRow) => (
            <Runs runs={runsOf(row.instrument, mountings)} site={selected?.site ?? site} />
          )}
          size="small"
          stripedRows
          data-testid="instrument-table"
          emptyMessage="No instruments match."
        >
          <Column expander style={{ width: '2.5rem' }} />
          <Column
            header="Instrument"
            body={(row: InstrumentRow) => (
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rounded-[2px]"
                  style={{ backgroundColor: instrumentColor(row.instrument) }}
                />
                <span className="font-semibold text-foreground">{INSTRUMENT_LABEL[row.instrument]}</span>
                {row.publishedName !== INSTRUMENT_LABEL[row.instrument] && (
                  <span className="text-xs text-foreground-muted">{row.publishedName}</span>
                )}
              </span>
            )}
          />
          <Column
            header="Where"
            body={(row: InstrumentRow) => (
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={
                    row.where.kind === 'PORT'
                      ? 'inline-block h-2 w-2 rounded-full bg-gpp'
                      : row.where.kind === 'OFF_PORT'
                        ? 'inline-block h-2 w-2 rounded-full border border-subtle bg-transparent'
                        : 'inline-block h-2 w-2 rounded-full bg-transparent'
                  }
                />
                <span className={row.where.kind === 'NOT_RECORDED' ? 'text-foreground-muted italic' : ''}>
                  {locationLabel(row)}
                </span>
                {row.changesTonight && <Tag value="changes tonight" severity="warning" className="!text-[0.6rem]" />}
              </span>
            )}
          />
          <Column
            header="Status"
            body={(row: InstrumentRow) => (row.usage === null ? null : <StatusTag status={usageStatus(row.usage)} />)}
          />
          {/* "Dates", echoing the expansion's own first column: this row is
              one line of that list - the run covering the night reported. */}
          <Column
            header="Dates"
            body={(row: InstrumentRow) =>
              row.run === null ? null : (
                <span className="text-xs whitespace-nowrap text-foreground-secondary tabular-nums">
                  {printEvening(firstEveningDate(selected?.site ?? site, row.run))} –{' '}
                  {printEvening(lastEveningDate(selected?.site ?? site, row.run))}
                </span>
              )
            }
          />
          <Column header="Note" body={(row: InstrumentRow) => <NoteCell note={row.note} />} />
        </DataTable>
      )}
    </div>
  );
}
