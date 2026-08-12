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
import { when } from '@gemini-hlsw/lucuma-common-ui';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { type JSX, useState } from 'react';

import { useSelection } from '@/app/useSelection';
import { useSemester } from '@/app/useSemester';
import { useUrlParam } from '@/app/useUrlParam';
import { SyntheticDataTag } from '@/components/ui/SyntheticDataTag';
import { buildInstrumentRows, type InstrumentRow, matchesInstrument, runsOf } from '@/domain/instrumentFinder';
import { firstEveningDate, lastEveningDate, observingNightInterval } from '@/domain/siteTime';
import { USAGE_LABEL } from '@/domain/timeline';
import type { Mounting, Site } from '@/domain/types';
import { LOCATION_LABEL } from '@/features/components/componentLabels';
import { INSTRUMENT_LABEL, instrumentColor } from '@/features/timeline/timelineOptions';
import { useSemesterSchedule } from '@/gql/hooks';

const EVENING_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const printEvening = (eveningDate: string): string => EVENING_FORMAT.format(new Date(`${eveningDate}T12:00:00Z`));

/** Where an instrument is, in the words the schedule uses for a port. */
const whereLabel = (row: InstrumentRow): string => {
  switch (row.where.kind) {
    case 'PORT':
      return row.where.rowLabel;
    case 'OFF_PORT':
      // The workbook records usable-with-no-port and never says where the
      // instrument physically sits, so UNKNOWN prints as the plain fact.
      return row.where.location === 'UNKNOWN' ? 'Not on a port' : `Not on a port · ${LOCATION_LABEL.UNKNOWN}`;
    default:
      return 'Not recorded';
  }
};

/** The expansion: every run over the semester, in evening dates. */
function Runs({ runs, site }: { runs: readonly Mounting[]; site: Site }): JSX.Element {
  return (
    <ul className="ml-10 flex flex-col gap-1 py-1 text-xs" data-testid="instrument-runs">
      {runs.map((run) => (
        <li key={run.id} className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-foreground-secondary tabular-nums">
            {printEvening(firstEveningDate(site, run.interval))} – {printEvening(lastEveningDate(site, run.interval))}
          </span>
          <span>{run.port === null ? 'Not on a port' : run.rowLabel}</span>
          <span className="text-foreground-muted">{USAGE_LABEL[run.usage]}</span>
          {when(run.note, (note) => (
            <span className="text-foreground-muted italic">{note}</span>
          ))}
        </li>
      ))}
    </ul>
  );
}

export default function InstrumentsPage(): JSX.Element {
  const { site, observingNight } = useSelection();
  const { semester: selected, loading: loadingSets, error: setsError } = useSemester();
  const [search, setSearch] = useUrlParam('q', '', { replace: true });
  const [expanded, setExpanded] = useState<InstrumentRow[]>([]);

  const bounds =
    selected === null
      ? null
      : { start: `${selected.firstNight}T00:00:00.000Z`, end: `${selected.lastNight}T23:59:59.999Z` };

  const { mountings, loading, error } = useSemesterSchedule(selected?.site ?? site, bounds);

  const night = observingNightInterval(selected?.site ?? site, observingNight);
  const rows = buildInstrumentRows({ mountings, night });
  const visible = rows.filter((row) => matchesInstrument(row, search));

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
            Where every instrument is on the night of {printEvening(firstEveningDate(selected?.site ?? site, night))}.{' '}
            {onTelescope} on the telescope. Open a row for its runs this semester.
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
                  {whereLabel(row)}
                </span>
                {row.changesTonight && <Tag value="changes tonight" severity="warning" className="!text-[0.6rem]" />}
              </span>
            )}
          />
          <Column
            header="Status"
            body={(row: InstrumentRow) =>
              row.usage === null ? null : (
                <span className="flex flex-col items-start gap-0.5">
                  <Tag
                    value={USAGE_LABEL[row.usage]}
                    severity={
                      row.usage === 'SCIENCE' ? 'success' : row.usage === 'ENGINEERING' ? 'info' : ('danger' as const)
                    }
                    className="!text-[0.6rem]"
                  />
                  {when(row.note, (note) => (
                    <span className="text-[0.65rem] text-foreground-muted italic">{note}</span>
                  ))}
                </span>
              )
            }
          />
          <Column
            header="This run"
            body={(row: InstrumentRow) =>
              row.run === null ? null : (
                <span className="text-xs text-foreground-secondary tabular-nums">
                  {printEvening(firstEveningDate(selected?.site ?? site, row.run))} –{' '}
                  {printEvening(lastEveningDate(selected?.site ?? site, row.run))}
                </span>
              )
            }
          />
        </DataTable>
      )}
    </div>
  );
}
