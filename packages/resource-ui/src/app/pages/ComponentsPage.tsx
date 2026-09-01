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
import { WhereCell } from '@/components/ui/WhereCell';
import { buildFinderRows, type FinderRow, historyOf, matchesComponent, whereOf } from '@/domain/componentFinder';
import { eveningLabel, eveningRange, firstEveningDate, nightCount, observingNightInterval } from '@/domain/siteTime';
import type { ComponentBlock, ComponentType, Instrument, Mounting, Site } from '@/domain/types';
import { ComponentIdentityCell, StatusCell } from '@/features/components/componentCells';
import { componentStatus, componentWhere, TYPE_LABEL, whereLabel } from '@/features/components/componentLabels';
import { InstrumentSwatch } from '@/features/timeline/InstrumentSwatch';
import { INSTRUMENT_LABEL } from '@/features/timeline/timelineOptions';
import { useComponentBrowser } from '@/gql/hooks';

/** The piece's records over the site's whole span, with "Installed" resolved to where it was. */
function History({
  blocks,
  mountings,
  instrument,
  site,
}: {
  blocks: readonly ComponentBlock[];
  mountings: readonly Mounting[];
  instrument: Instrument;
  site: Site;
}): JSX.Element {
  const rows = blocks.map((block) => ({
    id: block.id,
    dates: eveningRange(site, block.interval),
    nights: nightCount(site, block.interval),
    where: whereLabel(whereOf(instrument, block, mountings, block.interval)),
    status: componentStatus(block.usage, block.location !== 'INSTALLED', block.note) ?? {
      label: 'Not recorded',
      tone: 'muted' as const,
    },
    note: block.note,
  }));

  return (
    <RecordHistoryTable
      rows={rows}
      whereHeader="Location"
      ariaLabel="Component history"
      testId="component-history"
      emptyMessage="No records for this piece."
    />
  );
}

export default function ComponentsPage(): JSX.Element {
  const { site, observingNight } = useSelection();
  const { semester: selected, loading: loadingSets, error: setsError } = useSemester();
  // The filters live in the URL, so "the R400 gratings at GS" is a sendable link.
  const [search, setSearch] = useUrlParam('q', '', { replace: true });
  const [instrumentParam, setInstrumentParam] = useUrlParam('instrument', '', { replace: true });
  const [typeParam, setTypeParam] = useUrlParam('type', '', { replace: true });
  // `Object.hasOwn`, not `in`: `in` answers true for `toString` and `__proto__`, leaving All over an empty table.
  const instrument = Object.hasOwn(INSTRUMENT_LABEL, instrumentParam) ? (instrumentParam as Instrument) : null;
  const componentType = Object.hasOwn(TYPE_LABEL, typeParam) ? (typeParam as ComponentType) : null;
  // Which rows are open stays local: it is reading posture, not a finding.
  const [expanded, setExpanded] = useState<FinderRow[]>([]);

  const activeSite = selected?.site ?? site;

  // The site's whole recorded span, not the semester: a piece's story does not restart in February.
  const bounds = useSiteSpan();

  const { components, componentBlocks, mountings, loading, error } = useComponentBrowser(activeSite, bounds);

  const night = observingNightInterval(activeSite, observingNight);

  const rows = buildFinderRows({ components, blocks: componentBlocks, mountings, night });

  const visible = rows.filter(
    (row) =>
      matchesComponent(row.component, search) &&
      (instrument === null || row.component.instrument === instrument) &&
      (componentType === null || row.component.componentType === componentType),
  );

  // Every option carries its catalog count, and a type nothing has is not offered at all.
  const instrumentCounts = new Map<Instrument, number>();
  for (const component of components) {
    instrumentCounts.set(component.instrument, (instrumentCounts.get(component.instrument) ?? 0) + 1);
  }
  const instrumentOptions = [...instrumentCounts.entries()]
    .map(([value, count]) => countedOption(value, INSTRUMENT_LABEL[value], count))
    .sort((a, b) => a.label.localeCompare(b.label));

  const typeCounts = new Map<ComponentType, number>();
  for (const component of components) {
    typeCounts.set(component.componentType, (typeCounts.get(component.componentType) ?? 0) + 1);
  }
  const typeOptions = (Object.keys(TYPE_LABEL) as ComponentType[])
    .filter((value) => typeCounts.has(value))
    .map((value) => countedOption(value, TYPE_LABEL[value], typeCounts.get(value) ?? 0));

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
      <InstrumentSwatch instrument={row.component.instrument} className="py-0.5">
        <span className="text-xs text-foreground-muted">
          {total} {total === 1 ? 'piece' : 'pieces'}
          {installed > 0 && ` · ${installed} on telescope`}
        </span>
      </InstrumentSwatch>
    );
  };

  const failure = setsError ?? error;

  return (
    <div className="min-w-0">
      <PageHeader title="Components" demo={selected?.demo === true}>
        Where every instrument piece is on the night of {eveningLabel(firstEveningDate(activeSite, night))}. Open a row
        for its history.
      </PageHeader>

      {failure !== undefined && <ErrorAlert what="the components" error={failure} />}

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <FilterField label="Search">
          {(id) => (
            <InputText
              id={id}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Name, code, barcode or alias"
              className="w-72"
            />
          )}
        </FilterField>
        <FilterField label="Instrument">
          {(id) => (
            <Dropdown
              inputId={id}
              value={instrument}
              options={instrumentOptions}
              onChange={(event) => {
                setInstrumentParam((event.value as string | undefined) ?? '');
              }}
              showClear
              placeholder="All"
              className="w-44"
            />
          )}
        </FilterField>
        <FilterField label="Type">
          {(id) => (
            <Dropdown
              inputId={id}
              value={componentType}
              options={typeOptions}
              onChange={(event) => {
                setTypeParam((event.value as string | undefined) ?? '');
              }}
              showClear
              placeholder="All"
              className="w-40"
            />
          )}
        </FilterField>
      </div>

      {(loadingSets || loading) && <Loading what="the catalog" />}

      {!loading && !loadingSets && (
        // Grouped by instrument, so the subheader replaces a column printing "GMOS" two dozen times.
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
            <History
              blocks={historyOf(row.component.id, componentBlocks)}
              mountings={mountings}
              instrument={row.component.instrument}
              site={activeSite}
            />
          )}
          size="small"
          stripedRows
          data-testid="component-table"
          emptyMessage="No components match."
        >
          <Column expander style={{ width: '2.5rem' }} />
          <Column header="Component" body={(row: FinderRow) => <ComponentIdentityCell row={row} />} />
          <Column header="Type" body={(row: FinderRow) => TYPE_LABEL[row.component.componentType]} />
          <Column header="Where" body={(row: FinderRow) => <WhereCell where={componentWhere(row)} />} />
          <Column header="Status" body={(row: FinderRow) => <StatusCell row={row} />} />
          <Column header="Note" body={(row: FinderRow) => <NoteCell note={row.note} />} />
        </DataTable>
      )}
    </div>
  );
}
