import './ConfigurationRequestReview.css';

import { cn, isNotNullish, when } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { OverlayPanel } from 'primereact/overlaypanel';
import { type JSX, useMemo, useRef, useState } from 'react';

import { formatUtcMinute, joinTargetNames } from '@/gql/odb/shared';
import type { ChangeRequest, ConfigurationRequestStatus, ObservationRow, TimingWindowRow } from '@/gql/types';

/** Status dot colour per request state. WITHDRAWN reuses the denied colour —
 *  both mean "not going ahead", and a PI withdrawal isn't a reviewer action. */
const STATUS_ICON = {
  REQUESTED: 'cr-dot-open',
  APPROVED: 'cr-dot-approved',
  DENIED: 'cr-dot-denied',
  WITHDRAWN: 'cr-dot-denied',
} satisfies Record<ConfigurationRequestStatus, string>;

const STATUS_LABEL = {
  REQUESTED: 'Pending',
  APPROVED: 'Approved',
  DENIED: 'Denied',
  WITHDRAWN: 'Withdrawn',
} satisfies Record<ConfigurationRequestStatus, string>;

interface WindowGroup {
  readonly observationId: string;
  readonly windows: readonly TimingWindowRow[];
}

/** Target and Windows come from the observations; a request holds only ids. */
type VisibleRequest = ChangeRequest & { readonly observations: readonly ObservationRow[] };

/** Group a request's resolved observations by id, keeping only those that
 *  actually have scheduling windows (sc-9621). */
function windowGroups(observations: readonly ObservationRow[]): readonly WindowGroup[] {
  return observations.filter((o) => o.windows.length > 0).map((o) => ({ observationId: o.id, windows: o.windows }));
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** The checkbox column: which requests are ticked, and which may be. */
export interface RequestSelection {
  readonly selectedIds: ReadonlySet<string>;
  readonly onChange: (ids: ReadonlySet<string>) => void;
  /** Rows that may be ticked; defaults to every row. */
  readonly isSelectable?: (request: ChangeRequest) => boolean;
}

/** A program's requests, shared by Change Requests (sc-9094) and Proposals
 *  (sc-9595). Read-only without `selection`. */
export function ConfigurationRequestTable({
  requests,
  observationsById,
  selection,
}: {
  readonly requests: readonly ChangeRequest[];
  /** Resolves each request's observation ids to rows for the Target and Windows
   *  columns — a request carries only ids. */
  readonly observationsById: ReadonlyMap<string, ObservationRow>;
  readonly selection?: RequestSelection;
}): JSX.Element {
  // One overlay, reused for whichever request's windows were clicked (sc-9621).
  const windowsPanel = useRef<OverlayPanel>(null);
  const [windowsOf, setWindowsOf] = useState<readonly WindowGroup[]>([]);

  const visibleRequests = useMemo<VisibleRequest[]>(
    () =>
      requests.map((r) => ({
        ...r,
        observations: r.observationIds.map((id) => observationsById.get(id)).filter(isNotNullish),
      })),
    [requests, observationsById],
  );

  const ticked = useMemo(
    () => visibleRequests.filter((r) => selection?.selectedIds.has(r.id)),
    [visibleRequests, selection?.selectedIds],
  );

  return (
    <>
      <DataTable
        value={visibleRequests}
        dataKey="id"
        className="cr-review-table"
        // A body-template Checkbox never repainted (memoized cells).
        selectionMode="checkbox"
        selection={ticked}
        onSelectionChange={(e) => selection?.onChange(new Set(e.value.map((r) => r.id)))}
        isDataSelectable={(e) => selection?.isSelectable?.(e.data as VisibleRequest) ?? true}
        emptyMessage="No configuration requests to show."
      >
        {/* Columns without a `field` need a `columnKey`: PrimeReact keys cells by either plus
            index, so when the selection column goes (on Accept) they'd reuse a neighbour's cell. */}
        {when(selection, () => (
          <Column columnKey="selection" selectionMode="multiple" style={{ width: '2.5rem' }} />
        ))}
        <Column field="id" header="ID" sortable style={{ width: '6rem' }} />
        <Column
          columnKey="received"
          header="Received"
          style={{ width: '10rem' }}
          body={(r: ChangeRequest) => formatUtcMinute(r.createdAt)}
          headerTooltip="When the PI submitted the request (UTC)."
        />
        <Column
          columnKey="target"
          header="Target"
          style={{ width: '9rem' }}
          body={(r: VisibleRequest) => joinTargetNames(r.observations.map((o) => o.target))}
          headerTooltip="Target name(s) of the request's applicable observations. A configuration request carries only coordinates, so the names come from those observations (sc-10159)."
        />
        <Column field="ra" header="RA" style={{ width: '9rem' }} />
        <Column field="dec" header="Dec" style={{ width: '9rem' }} />
        <Column field="instrument" header="Config" style={{ width: '7rem' }} />
        <Column field="conditions" header="Conditions" style={{ width: '9rem' }} />
        <Column
          columnKey="observations"
          header="Observations"
          style={{ width: '8rem' }}
          body={(r: ChangeRequest) => r.observationIds.join(', ') || '—'}
        />
        <Column
          columnKey="windows"
          header="Windows"
          style={{ width: '6rem' }}
          headerTooltip="Scheduling windows across this request's observations. Click the count to see each window."
          body={(r: VisibleRequest) => {
            const groups = windowGroups(r.observations);
            const total = groups.reduce((n, g) => n + g.windows.length, 0);
            if (total === 0) return <span className="cr-untracked">none</span>;
            return (
              <Button
                link
                className="cr-windows-link"
                label={String(total)}
                onClick={(e) => {
                  setWindowsOf(groups);
                  windowsPanel.current?.toggle(e);
                }}
              />
            );
          }}
        />
        <Column
          columnKey="justification"
          header="Justification"
          // Without a width it was squeezed into the status dot.
          style={{ minWidth: '16rem' }}
          body={(r: ChangeRequest) => truncate(r.justification, 60)}
          headerTooltip="The PI's justification for the request."
        />
        <Column
          columnKey="status"
          header="Status"
          style={{ width: '5rem' }}
          body={(r: ChangeRequest) => {
            const note = r.feedback;
            const label = STATUS_LABEL[r.status];
            return (
              <span
                className={cn('cr-dot', STATUS_ICON[r.status])}
                title={note ? `${label} — reviewer response: ${note}` : label}
              />
            );
          }}
          // Not only resolved requests: staff may leave feedback before deciding.
          headerTooltip="Hover a request's status to see the reviewer's response, when one has been given."
        />
      </DataTable>

      <OverlayPanel ref={windowsPanel} className="cr-windows-panel">
        {windowsOf.length === 0 ? (
          <p className="cr-untracked">No scheduling windows.</p>
        ) : (
          windowsOf.map((g) => (
            <div key={g.observationId} className="cr-windows-group">
              <span className="cr-windows-obs">{g.observationId}</span>
              <ul className="cr-windows-list">
                {g.windows.map((w, i) => (
                  <li key={i} className={w.inclusion === 'EXCLUDE' ? 'cr-window-exclude' : undefined}>
                    {w.label}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </OverlayPanel>
    </>
  );
}
