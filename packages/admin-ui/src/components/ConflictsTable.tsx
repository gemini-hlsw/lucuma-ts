import './checkTables.css';

import { Spinner, TriangleExclamation } from '@gemini-hlsw/lucuma-common-ui';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { type JSX, useMemo } from 'react';

import { friendlyError } from '@/gql/errors';
import {
  type ConflictRow,
  conflictRows,
  type ConflictSource,
  conflictTargetLabel,
  isCheckable,
  type PositionedSource,
  useConflictCandidates,
  useConflictTargetNames,
} from '@/gql/odb/conflicts';
import { formatModeType } from '@/gql/odb/shared';
import { exploreProgramUrl } from '@/lib/explore';

/**
 * "Potential Conflicts" (sc-9243): plans in other active programs, requests and
 * observations, of a similar mode within half the requested configuration's
 * field of view. The ODB judges proximity, so the separation shown is for the
 * reader. Each source is checked on its own, so each has its own section.
 */
export function ConflictsTable({
  title,
  sources,
}: {
  readonly title: string;
  readonly sources: readonly ConflictSource[];
}): JSX.Element {
  const checkable = useMemo(() => sources.filter(isCheckable), [sources]);
  const unchecked = useMemo(() => sources.filter((s) => !isCheckable(s)), [sources]);

  return (
    <section className="check-section">
      <h3 className="check-title" title="Similar-mode plans in other active programs within half the field of view.">
        {title}
      </h3>
      {checkable.map((source) => (
        <SourceConflicts key={source.id} source={source} />
      ))}
      {unchecked.length > 0 && (
        <p className="check-error">
          <TriangleExclamation /> Not checked, for lack of a position or a similar observing mode:{' '}
          {unchecked.map((s) => s.id).join(', ')}.
        </p>
      )}
    </section>
  );
}

/** Callers build their sources afresh on every render, so a section is compared by what it checks. */
function SourceConflicts({ source }: { readonly source: PositionedSource }): JSX.Element {
  const { candidates, loading, error, truncated } = useConflictCandidates(source);
  const matched = useMemo(() => conflictRows(source, candidates), [source, candidates]);
  const targetsById = useConflictTargetNames(matched);
  // Fold the resolved target names into the rows so the DataTable's `value`
  // identity changes when they arrive — a body closure over `targetsById`
  // wouldn't repaint, since PrimeReact memoizes cells on the row value.
  const rows = useMemo(
    () => matched.map((r) => ({ ...r, target: conflictTargetLabel(r, targetsById) })),
    [matched, targetsById],
  );

  return (
    <div>
      <h4 className="check-title">{source.id}</h4>
      {error && (
        <p className="check-error">
          <TriangleExclamation /> Conflict check failed: {friendlyError(error)}
        </p>
      )}
      {truncated && (
        <p className="check-error">
          <TriangleExclamation /> More candidates matched than this check can list. The result is incomplete.
        </p>
      )}
      {loading && (
        <p className="check-note">
          <Spinner spin className="check-spinner" /> Checking active programs…
        </p>
      )}
      {/* A source with nothing to show is one line, not an empty table; and never an all-clear
        on an incomplete pool, since a failed or truncated check that reads "no conflicts
        found" is what a missed duplicate looks like. */}
      {rows.length === 0 && !loading && !error && !truncated && (
        <p className="check-note">No conflicting plans found in other active programs.</p>
      )}
      {rows.length > 0 && (
        <DataTable value={rows} dataKey="key" className="pl-striped-table">
          <Column
            header="Program ID"
            style={{ width: '14rem' }}
            headerTooltip="The conflicting plan: a configuration request (program reference + request id) or an observation reference. The program reference links to Explore."
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
            headerTooltip="The conflicting request's status, or the observation's workflow state."
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
            body={(r: ConflictRow) => (r.sepArcsec === null ? '—' : `${r.sepArcsec.toFixed(1)}″`)}
          />
          <Column header="Config" style={{ width: '10rem' }} body={(r: ConflictRow) => formatModeType(r.modeType)} />
        </DataTable>
      )}
    </div>
  );
}
