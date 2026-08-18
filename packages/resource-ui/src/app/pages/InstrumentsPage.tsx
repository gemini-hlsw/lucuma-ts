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
 * two read as one tool rather than two. What they share is shared in code, not
 * copied: the header, the filter fields, the Where cell, the row expansion.
 */
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { type JSX, useState } from 'react';

import { useSelection } from '@/app/useSelection';
import { useSemester } from '@/app/useSemester';
import { useSiteSpan } from '@/app/useSiteSpan';
import { useUrlParam } from '@/app/useUrlParam';
import { FilterField } from '@/components/ui/FilterField';
import { countedOption } from '@/components/ui/filterOptions';
import { NoteCell } from '@/components/ui/NoteCell';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert, Loading } from '@/components/ui/PageStatus';
import { RecordHistoryTable } from '@/components/ui/RecordHistoryTable';
import { type RecordStatus, StatusTag } from '@/components/ui/StatusTag';
import { WhereCell, type WhereReading } from '@/components/ui/WhereCell';
import {
  buildInstrumentRows,
  type InstrumentRow,
  locationLabel,
  locationOptions,
  matchesInstrument,
  mountingLocationLabel,
  runsOf,
} from '@/domain/instrumentFinder';
import { eveningLabel, eveningRange, firstEveningDate, nightCount, observingNightInterval } from '@/domain/siteTime';
import { USAGE_LABEL } from '@/domain/timeline';
import type { Mounting, ResourceUsage, Site } from '@/domain/types';
import { InstrumentSwatch } from '@/features/timeline/InstrumentSwatch';
import { INSTRUMENT_LABEL } from '@/features/timeline/timelineOptions';
import { useSemesterSchedule } from '@/gql/hooks';

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
 * One row's Where cell, for the shared `WhereCell` - the component browser's
 * `componentWhere` on this side of the pair.
 *
 * An off-port run reads as off the telescope rather than as an absence: the
 * workbook recorded the instrument as usable, it just did not say where it sits.
 */
const instrumentWhere = (row: InstrumentRow): WhereReading => ({
  presence:
    row.where.kind === 'PORT' ? 'ON_TELESCOPE' : row.where.kind === 'OFF_PORT' ? 'OFF_TELESCOPE' : 'NOT_RECORDED',
  label: locationLabel(row),
  changes: row.changesTonight ? 'changes tonight' : null,
});

/**
 * The expansion: every run over the site's record, in evening dates, with how
 * many nights each lasted - a run list is read for its lengths, and the count
 * is already in the interval the query returns.
 */
function Runs({ runs, site }: { runs: readonly Mounting[]; site: Site }): JSX.Element {
  const rows = runs.map((run) => ({
    id: run.id,
    dates: eveningRange(site, run.interval),
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
      <PageHeader title="Instruments" demo={selected?.demo === true}>
        Every instrument {activeSite} has ever recorded, and where it is on the night of{' '}
        {eveningLabel(firstEveningDate(activeSite, night))}. {onTelescope} of {rows.length} on the telescope. Open a row
        for its runs.
      </PageHeader>

      {failure !== undefined && <ErrorAlert what="the instruments" error={failure} />}

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <FilterField label="Search">
          {(id) => (
            <InputText
              id={id}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Instrument or published name"
              className="w-72"
            />
          )}
        </FilterField>
        <FilterField label="Location">
          {(id) => (
            <Dropdown
              inputId={id}
              value={locations.some((entry) => entry.label === location) ? location : null}
              options={locations.map((entry) => countedOption(entry.label, entry.label, entry.count))}
              onChange={(event) => {
                setLocation((event.value as string | undefined) ?? '');
              }}
              showClear
              placeholder="Anywhere"
              className="w-56"
            />
          )}
        </FilterField>
      </div>

      {(loading || loadingSets) && <Loading what="the instruments" />}

      {!loading && !loadingSets && (
        <DataTable
          value={[...visible]}
          dataKey="instrument"
          expandedRows={expanded}
          onRowToggle={(event) => {
            setExpanded(event.data as InstrumentRow[]);
          }}
          rowExpansionTemplate={(row: InstrumentRow) => (
            <Runs runs={runsOf(row.instrument, mountings)} site={activeSite} />
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
              <InstrumentSwatch instrument={row.instrument} publishedName={row.publishedName} />
            )}
          />
          <Column header="Where" body={(row: InstrumentRow) => <WhereCell where={instrumentWhere(row)} />} />
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
                  {eveningRange(activeSite, row.run)}
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
