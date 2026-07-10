import './checkTables.css';

import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { type JSX, useEffect, useRef, useState } from 'react';

import { type DuplicateRow, type DuplicateSource, findDuplicates } from '@/lib/geminiArchive';

interface DuplicatesState {
  readonly rows: readonly DuplicateRow[];
  readonly loading: boolean;
  readonly error: string | null;
}

/** The last check's result, tagged with the key it answers. Loading is
 *  derived (result key ≠ current key), so the effect never sets state
 *  synchronously — only from the fetch callbacks. */
interface FetchedDuplicates {
  readonly forKey: string;
  readonly rows: readonly DuplicateRow[];
  readonly error: string | null;
}

const NOTHING_FETCHED: FetchedDuplicates = { forKey: '', rows: [], error: null };

/** Run the sc-9244 duplication check whenever the sources change. Aborts the
 *  in-flight archive queries when the selection moves on. The check depends
 *  only on each source's search inputs — the fetch effect is keyed on those,
 *  so a re-mapped array with identical content doesn't refetch; the array
 *  itself is read through a ref (same pattern as useOdbData). */
function useDuplicates(sources: readonly DuplicateSource[]): DuplicatesState {
  const [fetched, setFetched] = useState<FetchedDuplicates>(NOTHING_FETCHED);
  const sourcesRef = useRef(sources);
  useEffect(() => {
    sourcesRef.current = sources;
  });
  const key = sources.length === 0 ? '' : JSON.stringify(sources.map((s) => [s.id, s.raDeg, s.decDeg, s.modeType]));
  useEffect(() => {
    if (key === '') return;
    const controller = new AbortController();
    findDuplicates(sourcesRef.current, controller.signal)
      .then((rows) => setFetched({ forKey: key, rows, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setFetched({ forKey: key, rows: [], error: err instanceof Error ? err.message : String(err) });
      });
    return () => controller.abort();
  }, [key]);
  if (key === '') return { rows: [], loading: false, error: null };
  const current = fetched.forKey === key;
  return {
    rows: current ? fetched.rows : [],
    loading: !current,
    error: current ? fetched.error : null,
  };
}

/**
 * "Potential Duplicate Observations" table (sc-9244): archive data that would
 * duplicate the given observations / change requests, one row per archive
 * observation. P/# = files with QA=Pass / total files — visitor instruments
 * may not set QA, so P is advisory, not authoritative.
 */
export function DuplicatesTable({
  title,
  sources,
}: {
  readonly title: string;
  readonly sources: readonly DuplicateSource[];
}): JSX.Element {
  const { rows, loading, error } = useDuplicates(sources);

  const unsearchable = sources.filter((s) => s.raDeg === null || s.decDeg === null).length;

  return (
    <section className="check-section">
      <h3
        className="check-title"
        title="Existing archive data with a similar instrument configuration near the requested coordinates (sc-9244). Searched via archive.gemini.edu with a radius of half the configuration's field of view."
      >
        {title}
        {loading && <i className="pi pi-spin pi-spinner check-spinner" />}
      </h3>
      {error && (
        <p className="check-error">
          <i className="pi pi-exclamation-triangle" /> Archive query failed: {error}
        </p>
      )}
      {unsearchable > 0 && !loading && (
        <p className="check-note">
          {unsearchable} of {sources.length} selected can’t be checked — no fixed coordinates (e.g. a Target of
          Opportunity configuration).
        </p>
      )}
      <DataTable
        value={rows as DuplicateRow[]}
        dataKey="key"
        className="pl-striped-table"
        emptyMessage={loading ? 'Searching the archive…' : 'No potential duplicates found in the archive.'}
      >
        <Column
          field="sourceId"
          header="ID"
          style={{ width: '6rem' }}
          headerTooltip="The selected request/observation this archive match applies to."
        />
        <Column
          header="ObsId"
          style={{ width: '13rem' }}
          headerTooltip="The archive observation containing the matching data. Opens the archive search for that observation."
          body={(r: DuplicateRow) => (
            <a href={`https://archive.gemini.edu/searchform/${r.observationId}`} target="_blank" rel="noreferrer">
              {r.observationId}
            </a>
          )}
        />
        <Column
          header="P / #"
          style={{ width: '5rem' }}
          headerTooltip="Files with QA = Pass / total files in this observation. Visitor instruments may not set QA."
          body={(r: DuplicateRow) => `${r.passCount} / ${r.fileCount}`}
        />
        <Column field="target" header="Target" headerTooltip="The archive dataset's object name." />
        <Column
          header="RA"
          style={{ width: '7rem' }}
          body={(r: DuplicateRow) => r.raDeg?.toFixed(5) ?? '—'}
          headerTooltip="Right ascension of the archive data, degrees."
        />
        <Column
          header="Dec"
          style={{ width: '7rem' }}
          body={(r: DuplicateRow) => r.decDeg?.toFixed(5) ?? '—'}
          headerTooltip="Declination of the archive data, degrees."
        />
        <Column
          header="Sep"
          style={{ width: '5rem' }}
          headerTooltip="Angular separation between the archive data and the requested coordinates."
          body={(r: DuplicateRow) => (r.sepArcsec === null ? '—' : `${r.sepArcsec.toFixed(1)}″`)}
        />
        <Column field="instrument" header="Instrument" style={{ width: '7rem' }} />
        <Column field="fpu" header="FPU" style={{ width: '7rem' }} headerTooltip="Focal plane unit (slit / mask)." />
        <Column field="disperser" header="Disperser" style={{ width: '6rem' }} />
        <Column
          header="λ"
          style={{ width: '4.5rem' }}
          headerTooltip="Central wavelength, µm."
          body={(r: DuplicateRow) => r.wavelengthUm?.toFixed(2) ?? '—'}
        />
        <Column field="filter" header="Filter" style={{ width: '6rem' }} />
      </DataTable>
    </section>
  );
}
