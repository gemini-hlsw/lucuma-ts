import './checkTables.css';

import { useApolloClient } from '@apollo/client/react';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';

import {
  type ConflictCandidate,
  type ConflictRow,
  CONFLICTS_QUERY,
  type ConflictSource,
  formatModeType,
  mapConflictCandidates,
  matchConflicts,
  similarModeTypes,
} from '@/gql/conflicts';
import { hasOdbToken } from '@/gql/useOdbData';

interface CandidatesState {
  readonly candidates: readonly ConflictCandidate[];
  readonly loading: boolean;
  readonly error: string | null;
}

/** The last fetch's result, tagged with the key it answers. Loading is
 *  derived (result key ≠ current key), so the effect never sets state
 *  synchronously — only from the query callbacks. */
interface FetchedCandidates {
  readonly forKey: string;
  readonly candidates: readonly ConflictCandidate[];
  readonly error: string | null;
}

const NOTHING_FETCHED: FetchedCandidates = { forKey: '', candidates: [], error: null };

/** Fetch both sc-9243 candidate pools for the union of the sources' similar
 *  observing modes. Keyed on that union — reselecting sources with the same
 *  modes reuses the response; the per-source cone match happens in a memo. */
function useConflictCandidates(sources: readonly ConflictSource[]): CandidatesState {
  const apollo = useApolloClient();
  const [fetched, setFetched] = useState<FetchedCandidates>(NOTHING_FETCHED);
  const modeTypes = Array.from(new Set(sources.flatMap((s) => similarModeTypes(s.modeType)))).sort();
  const key = modeTypes.join(',');
  const modeTypesRef = useRef(modeTypes);
  useEffect(() => {
    modeTypesRef.current = modeTypes;
  });
  useEffect(() => {
    if (key === '' || !hasOdbToken()) return;
    let cancelled = false;
    apollo
      .query({
        query: CONFLICTS_QUERY,
        variables: { modeTypes: [...modeTypesRef.current], today: new Date().toISOString().slice(0, 10) },
        fetchPolicy: 'network-only',
      })
      .then((res) => {
        if (cancelled) return;
        if (res.data === undefined) {
          setFetched({ forKey: key, candidates: [], error: 'Query returned no data.' });
        } else {
          setFetched({ forKey: key, candidates: mapConflictCandidates(res.data), error: null });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetched({ forKey: key, candidates: [], error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [apollo, key]);
  if (key === '' || !hasOdbToken()) return { candidates: [], loading: false, error: null };
  const current = fetched.forKey === key;
  return {
    candidates: current ? fetched.candidates : [],
    loading: !current,
    error: current ? fetched.error : null,
  };
}

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
  const rows = useMemo(() => matchConflicts(sources, candidates), [sources, candidates]);

  return (
    <section className="check-section">
      <h3
        className="check-title"
        title="Planned observations in other active programs that would yield equivalent data (sc-9243): a similar observing mode within half the requested configuration's field of view. Covers configuration requests and, since ToO configurations carry no coordinates, the observations of active ToO programs."
      >
        {title}
        {loading && <i className="pi pi-spin pi-spinner check-spinner" />}
      </h3>
      {error && (
        <p className="check-error">
          <i className="pi pi-exclamation-triangle" /> Conflict check failed: {error}
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
          field="label"
          header="ObsId"
          style={{ width: '14rem' }}
          headerTooltip="The conflicting plan: a configuration request (program reference + request id) or a ToO program's observation reference."
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
          headerTooltip="Target name where known — approved configurations carry only coordinates."
        />
        <Column
          header="RA"
          style={{ width: '7rem' }}
          body={(r: ConflictRow) => r.raDeg?.toFixed(5) ?? '—'}
          headerTooltip="Right ascension of the conflicting plan, degrees."
        />
        <Column
          header="Dec"
          style={{ width: '7rem' }}
          body={(r: ConflictRow) => r.decDeg?.toFixed(5) ?? '—'}
          headerTooltip="Declination of the conflicting plan, degrees."
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
