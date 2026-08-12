/**
 * The component browser - where is every instrument piece, tonight.
 *
 * Resource is the ICTD replacement, and this is the ICTD half: the semester
 * views answer "what is on the telescope"; this answers "where is the R400
 * grating". One plain DataTable, one row per piece, because the working set is
 * under a hundred rows and a finder's job is search, not presentation.
 *
 * ## The night, not the wall clock
 *
 * "Where is it" is answered for the URL's observing night - defaulting to
 * tonight - through the same selection the night view reads. That keeps the
 * page linkable, keeps "now" out of the domain layer, and keeps the tests
 * anchored to fixture dates.
 *
 * ## Search is client-side
 *
 * The whole catalog is already in hand (one unpaged response, by design), so
 * filtering here saves a round trip per keystroke. The API's own `search`
 * argument exists for consumers that do not hold the catalog.
 */
import { when } from '@gemini-hlsw/lucuma-common-ui';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { type JSX, useState } from 'react';

import { useSelection } from '@/app/useSelection';
import { useSemester } from '@/app/useSemester';
import { useUrlParam } from '@/app/useUrlParam';
import { SyntheticDataTag } from '@/components/ui/SyntheticDataTag';
import { buildFinderRows, type FinderRow, historyOf, matchesComponent } from '@/domain/componentFinder';
import { firstEveningDate, lastEveningDate, observingNightInterval } from '@/domain/siteTime';
import type { ComponentBlock, ComponentType, Instrument, Site } from '@/domain/types';
import { StatusCell, WhereCell } from '@/features/components/componentCells';
import { PLACE_LABEL, TYPE_LABEL } from '@/features/components/componentLabels';
import { INSTRUMENT_LABEL, instrumentColor } from '@/features/timeline/timelineOptions';
import { useComponentBrowser } from '@/gql/hooks';

const EVENING_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const printEvening = (eveningDate: string): string => EVENING_FORMAT.format(new Date(`${eveningDate}T12:00:00Z`));

/**
 * The expansion: the piece's records over the semester, oldest first, phrased
 * in the evening dates the published sheet is read in.
 */
function History({ blocks, site }: { blocks: readonly ComponentBlock[]; site: Site }): JSX.Element {
  return (
    <ul className="ml-10 flex flex-col gap-1 py-1 text-xs" data-testid="component-history">
      {blocks.map((block) => (
        <li key={block.id} className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-foreground-secondary tabular-nums">
            {printEvening(firstEveningDate(site, block.interval))} –{' '}
            {printEvening(lastEveningDate(site, block.interval))}
          </span>
          <span>{block.place === 'INSTALLED' ? 'Installed' : PLACE_LABEL[block.place]}</span>
          <span className="text-foreground-muted">{block.usage}</span>
          {when(block.note, (note) => (
            <span className="text-foreground-muted italic">{note}</span>
          ))}
        </li>
      ))}
    </ul>
  );
}

export default function ComponentsPage(): JSX.Element {
  const { site, observingNight } = useSelection();
  // The resolved semester - the same reading the masthead shows
  // (app/useSemester.ts).
  const { semester: selected, loading: loadingSets, error: setsError } = useSemester();
  // The filters live in the URL, so "the R400 gratings at GS" is a sendable
  // link. Replace-mode: a keystroke must not become a history entry. An
  // unrecognised instrument or type reads as "All" rather than erroring.
  const [search, setSearch] = useUrlParam('q', '', { replace: true });
  const [instrumentParam, setInstrumentParam] = useUrlParam('instrument', '', { replace: true });
  const [typeParam, setTypeParam] = useUrlParam('type', '', { replace: true });
  const instrument = instrumentParam in INSTRUMENT_LABEL ? (instrumentParam as Instrument) : null;
  const componentType = typeParam in TYPE_LABEL ? (typeParam as ComponentType) : null;
  // Which rows are open stays local: it is reading posture, not a finding.
  const [expanded, setExpanded] = useState<FinderRow[]>([]);

  const bounds =
    selected === null
      ? null
      : { start: `${selected.firstNight}T00:00:00.000Z`, end: `${selected.lastNight}T23:59:59.999Z` };

  const { components, componentBlocks, mountings, loading, error } = useComponentBrowser(
    selected?.site ?? site,
    bounds,
  );

  const night = observingNightInterval(selected?.site ?? site, observingNight);

  const rows = buildFinderRows({ components, blocks: componentBlocks, mountings, night });

  const visible = rows.filter(
    (row) =>
      matchesComponent(row.component, search) &&
      (instrument === null || row.component.instrument === instrument) &&
      (componentType === null || row.component.componentType === componentType),
  );

  // The filter dropdowns say what choosing them buys: options are sorted by
  // label and carry the piece count the catalog holds for them, and a type
  // nothing in the catalog has is not offered at all.
  const instrumentCounts = new Map<Instrument, number>();
  for (const component of components) {
    instrumentCounts.set(component.instrument, (instrumentCounts.get(component.instrument) ?? 0) + 1);
  }
  const instrumentOptions = [...instrumentCounts.entries()]
    .map(([value, count]) => ({ label: `${INSTRUMENT_LABEL[value]} (${count})`, value }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const typeCounts = new Map<ComponentType, number>();
  for (const component of components) {
    typeCounts.set(component.componentType, (typeCounts.get(component.componentType) ?? 0) + 1);
  }
  const typeOptions = (Object.keys(TYPE_LABEL) as ComponentType[])
    .filter((value) => typeCounts.has(value))
    .map((value) => ({ label: `${TYPE_LABEL[value]} (${typeCounts.get(value) ?? 0})`, value }));

  // What each group's subheader says: how many pieces, and how many of them
  // are on the telescope tonight - the browser's one-line answer per
  // instrument before any row is read.
  const groupSummaries = new Map<Instrument, { total: number; installed: number }>();
  for (const row of visible) {
    const entry = groupSummaries.get(row.component.instrument) ?? { total: 0, installed: 0 };
    entry.total += 1;
    if (row.where.kind === 'INSTALLED') {
      entry.installed += 1;
    }
    groupSummaries.set(row.component.instrument, entry);
  }

  const groupHeader = (row: FinderRow): JSX.Element => {
    const summary = groupSummaries.get(row.component.instrument);
    const total = summary?.total ?? 0;
    const installed = summary?.installed ?? 0;
    return (
      <span className="flex items-center gap-2 py-0.5">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-[2px]"
          style={{ backgroundColor: instrumentColor(row.component.instrument) }}
        />
        <span className="font-semibold text-foreground">{INSTRUMENT_LABEL[row.component.instrument]}</span>
        <span className="text-xs text-foreground-muted">
          {total} {total === 1 ? 'piece' : 'pieces'}
          {installed > 0 && ` · ${installed} on telescope`}
        </span>
      </span>
    );
  };

  const failure = setsError ?? error;

  return (
    <div className="min-w-0">
      <header className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">Components</h1>
            {selected?.demo === true && <SyntheticDataTag />}
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            Where every instrument piece is on the night of{' '}
            {printEvening(firstEveningDate(selected?.site ?? site, night))}. Open a row for its history.
          </p>
        </div>
      </header>

      {failure !== undefined && (
        <p role="alert" className="mb-4 rounded border border-red-700/60 bg-red-900/30 p-3 text-sm text-red-100">
          Could not load the components: {failure.message}
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
            placeholder="Name, code, barcode or alias"
            aria-label="Search components"
            className="w-72"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          Instrument
          <Dropdown
            value={instrument}
            options={instrumentOptions}
            onChange={(event) => {
              setInstrumentParam((event.value as string | undefined) ?? '');
            }}
            showClear
            placeholder="All"
            aria-label="Instrument"
            className="w-44"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          Type
          <Dropdown
            value={componentType}
            options={typeOptions}
            onChange={(event) => {
              setTypeParam((event.value as string | undefined) ?? '');
            }}
            showClear
            placeholder="All"
            aria-label="Component type"
            className="w-40"
          />
        </label>
      </div>

      {(loadingSets || loading) && <p className="text-sm text-foreground-muted">Loading the catalog…</p>}

      {!loading && !loadingSets && (
        // Grouped by instrument rather than one flat list with a repeating
        // Instrument column: the catalog is contiguous per instrument, so the
        // subheader replaces a column that printed "GMOS" two dozen times, and
        // each group leads with its one-line answer. Column sorting is
        // deliberately absent - it would tear the groups apart, and the
        // search and filters are how a finder narrows.
        <DataTable
          value={[...visible]}
          dataKey="component.id"
          rowGroupMode="subheader"
          groupRowsBy="component.instrument"
          rowGroupHeaderTemplate={groupHeader}
          expandedRows={expanded}
          onRowToggle={(event) => {
            setExpanded(event.data as FinderRow[]);
          }}
          rowExpansionTemplate={(row: FinderRow) => (
            <History blocks={historyOf(row.component.id, componentBlocks)} site={selected?.site ?? site} />
          )}
          size="small"
          stripedRows
          data-testid="component-table"
          emptyMessage="No components match."
        >
          <Column expander style={{ width: '2.5rem' }} />
          <Column
            header="Component"
            body={(row: FinderRow) => (
              <span className="flex flex-col">
                <span className="font-medium text-foreground">{row.component.name}</span>
                <span className="text-[0.65rem] text-foreground-muted">
                  {row.component.code}
                  {row.component.barcode !== null && ` · barcode ${row.component.barcode}`}
                </span>
              </span>
            )}
          />
          <Column header="Type" body={(row: FinderRow) => TYPE_LABEL[row.component.componentType]} />
          <Column header="Where" body={(row: FinderRow) => <WhereCell row={row} />} />
          <Column header="Status" body={(row: FinderRow) => <StatusCell row={row} />} />
        </DataTable>
      )}
    </div>
  );
}
