/**
 * The pieces riding on the telescope tonight, from the night projection.
 *
 * This is `TelescopeNight.components` - the scheduler-contract field - drawn
 * for a reader: one row per piece that is installed at some point during the
 * night or whose record changes during it. Stored spares are counted, not
 * listed; the component browser is the view for the whole catalog.
 *
 * A mid-night change is this table's reason to exist. The published schedules
 * are whole-night granular, so the synthetic component layer is where the
 * night view first meets a boundary inside the night, and the
 * change is named with its clock time rather than flattened to one state.
 */
import { when } from '@gemini-hlsw/lucuma-common-ui';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import type { JSX } from 'react';
import { Link, useLocation } from 'react-router';

import { NoteCell } from '@/components/ui/NoteCell';
import type { NightComponents } from '@/domain/adapters';
import { buildFinderRows, type FinderRow, ridesTonight } from '@/domain/componentFinder';
import type { TimeDisplay } from '@/domain/siteTime';
import type { Interval, Mounting, Site } from '@/domain/types';
import { StatusCell, WhereCell } from '@/features/components/componentCells';
import { TYPE_LABEL } from '@/features/components/componentLabels';
import { INSTRUMENT_LABEL } from '@/features/timeline/timelineOptions';

import { clockLabel } from './nightChartOptions';

export interface NightComponentsTableProps {
  readonly nightComponents: NightComponents;
  /** The night's mountings, unclipped - what resolves INSTALLED to a port. */
  readonly mountings: readonly Mounting[];
  readonly night: Interval;
  readonly site: Site;
  /** The masthead's clock choice - the change instants render in it. */
  readonly timeDisplay: TimeDisplay;
}

export function NightComponentsTable({
  nightComponents,
  mountings,
  night,
  site,
  timeDisplay,
}: NightComponentsTableProps): JSX.Element {
  const { search } = useLocation();

  const rows = buildFinderRows({
    components: nightComponents.components,
    blocks: nightComponents.blocks,
    mountings,
    night,
  });
  const riding = rows.filter(ridesTonight);
  const stored = rows.length - riding.length;

  return (
    <section className="mt-6" aria-label="Components tonight">
      <h2 className="mb-2 text-sm font-semibold text-foreground">Components tonight</h2>

      {riding.length === 0 ? (
        <p className="rounded border border-subtle bg-surface p-3 text-sm text-foreground-secondary">
          No components are on the telescope tonight.
        </p>
      ) : (
        <DataTable
          value={[...riding]}
          dataKey="component.id"
          size="small"
          stripedRows
          data-testid="night-component-table"
        >
          <Column
            header="Component"
            body={(row: FinderRow) => (
              <span className="flex flex-col">
                <span className="font-medium text-foreground">{row.component.name}</span>
                <span className="text-[0.65rem] text-foreground-muted">
                  {row.component.code}
                  {when(row.component.barcode, (barcode) => ` · barcode ${barcode}`)}
                </span>
              </span>
            )}
          />
          <Column header="Instrument" body={(row: FinderRow) => INSTRUMENT_LABEL[row.component.instrument]} />
          <Column header="Type" body={(row: FinderRow) => TYPE_LABEL[row.component.componentType]} />
          <Column
            header="Where"
            body={(row: FinderRow) => (
              <WhereCell
                row={row}
                changesTag={`changes at ${row.transitions.map((instant) => clockLabel(instant, site, timeDisplay)).join(', ')}`}
              />
            )}
          />
          <Column header="Status" body={(row: FinderRow) => <StatusCell row={row} />} />
          {/* The record's own words get a column, as on the browsers. */}
          <Column header="Note" body={(row: FinderRow) => <NoteCell note={row.note} />} />
        </DataTable>
      )}

      {stored > 0 && (
        <p className="mt-2 text-xs text-foreground-muted">
          {stored} more {stored === 1 ? 'piece is' : 'pieces are'} in storage tonight -{' '}
          <Link to={{ pathname: '/components', search }} className="text-gpp underline">
            the component browser
          </Link>{' '}
          lists them.
        </p>
      )}
    </section>
  );
}
