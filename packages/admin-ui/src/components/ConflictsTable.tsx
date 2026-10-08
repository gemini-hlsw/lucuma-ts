import './checkTables.css';

import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { type JSX, useMemo } from 'react';

import { Spinner, TriangleExclamation } from '@/components/Icons';
import { friendlyError } from '@/gql/errors';
import {
  type ConflictRow,
  type ConflictSource,
  conflictTargetLabel,
  matchConflicts,
  useConflictCandidates,
  useConflictTargetNames,
} from '@/gql/odb/conflicts';
import { formatModeType } from '@/gql/odb/shared';
import { exploreProgramUrl } from '@/lib/explore';

/**
 * "Potential Conflicts" table (sc-9243): active programs planning equivalent
 * observations — configuration requests, plus observations in active ToO
 * programs — with a similar observing mode within half the requested
 * configuration's field of view. The active-period and observing-mode filters
 * run in the ODB; the coordinate cone is computed here until the ODB grows
 * coordinate query filters (sc-9240), at which point it moves server-side.
 */
export function ConflictsTable({
  title,
  sources,
}: {
  readonly title: string;
  readonly sources: readonly ConflictSource[];
}): JSX.Element {
  const { candidates, loading, error } = useConflictCandidates(sources);
  const matched = useMemo(() => matchConflicts(sources, candidates), [sources, candidates]);
  const targetsById = useConflictTargetNames(matched);
  // Fold the resolved target names into the rows so the DataTable's `value`
  // identity changes when they arrive — a body closure over `targetsById`
  // wouldn't repaint, since PrimeReact memoizes cells on the row value.
  const rows = useMemo(
    () => matched.map((r) => ({ ...r, target: conflictTargetLabel(r, targetsById) })),
    [matched, targetsById],
  );

  return (
    <section className="check-section">
      <h3
        className="check-title"
        title="Planned observations in other active programs that would yield equivalent data (sc-9243): a similar observing mode within half the requested configuration's field of view. Covers configuration requests and, since ToO configurations carry no coordinates, the observations of active ToO programs."
      >
        {title}
        {loading && <Spinner spin className="check-spinner" />}
      </h3>
      {error && (
        <p className="check-error">
          <TriangleExclamation /> Conflict check failed: {friendlyError(error)}
        </p>
      )}
      <DataTable
        value={rows}
        dataKey="key"
        className="pl-striped-table"
        emptyMessage={loading ? 'Checking active programs…' : 'No conflicting plans found in other active programs.'}
      >
        <Column
          field="sourceId"
          header="ID"
          style={{ width: '6rem' }}
          headerTooltip="The selected request/observation this conflict applies to."
        />
        <Column
          header="Program ID"
          style={{ width: '14rem' }}
          headerTooltip="The conflicting plan: a configuration request (program reference + request id) or a ToO program's observation reference. The program reference links to Explore."
          body={(r: ConflictRow) => (
            <>
              {r.programLabel ? (
                <a href={exploreProgramUrl(r.programLabel)} target="_blank" rel="noreferrer">
                  {r.programLabel}
                </a>
              ) : (
                r.programId
              )}{' '}
              {r.detailLabel}
            </>
          )}
        />
        <Column
          field="status"
          header="Status"
          style={{ width: '7rem' }}
          headerTooltip="The conflicting request's status, or the ToO observation's workflow state."
        />
        <Column
          field="target"
          header="Target"
          headerTooltip="Target name(s). A configuration request carries only coordinates, so its name comes from its applicable observations (sc-10159)."
        />
        <Column
          field="ra"
          header="RA"
          style={{ width: '9rem' }}
          headerTooltip="Right ascension of the conflicting plan (HH:MM:SS.ss)."
        />
        <Column
          field="dec"
          header="Dec"
          style={{ width: '9rem' }}
          headerTooltip="Declination of the conflicting plan (DD:MM:SS.s)."
        />
        <Column
          header="Sep"
          style={{ width: '5rem' }}
          headerTooltip="Angular separation from the requested coordinates."
          body={(r: ConflictRow) => `${r.sepArcsec.toFixed(1)}″`}
        />
        <Column header="Config" style={{ width: '10rem' }} body={(r: ConflictRow) => formatModeType(r.modeType)} />
      </DataTable>
    </section>
  );
}
