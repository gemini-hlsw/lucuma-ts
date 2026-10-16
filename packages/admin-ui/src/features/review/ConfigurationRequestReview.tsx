import './ConfigurationRequestReview.css';

import { cn, isNotNullish, isNullish } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { InputTextarea } from 'primereact/inputtextarea';
import { OverlayPanel } from 'primereact/overlaypanel';
import { type JSX, type ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ConflictsTable } from '@/components/ConflictsTable';
import { DuplicatesTable } from '@/components/DuplicatesTable';
import { Check, PaperPlane, XMark } from '@/components/Icons';
import { Tile } from '@/components/Tile';
import { useToast } from '@/components/toastContext';
import { friendlyError } from '@/gql/errors';
import { formatUtcMinute, joinTargetNames } from '@/gql/odb/shared';
import type { ChangeRequest, ConfigurationRequestStatus, ObservationRow, TimingWindowRow } from '@/gql/types';

/** The reviewer's decision on a set of requests. */
export type Decision = 'APPROVED' | 'DENIED';

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

/** Carries the observations alongside the request because several columns
 *  (Target, Windows) describe the request through them — the request itself
 *  holds only a configuration and coordinates. */
type VisibleRequest = ChangeRequest & { readonly observations: readonly ObservationRow[] };

/** Group a request's resolved observations by id, keeping only those that
 *  actually have scheduling windows (sc-9621). */
function windowGroups(observations: readonly ObservationRow[]): readonly WindowGroup[] {
  return observations.filter((o) => o.windows.length > 0).map((o) => ({ observationId: o.id, windows: o.windows }));
}

/** Where the requests are being reviewed: on their own (a change request to an
 *  accepted program) or as part of a proposal still being decided. It only
 *  changes the wording of the seeded response. */
export type ReviewKind = 'change' | 'proposal';

function boilerplate(items: readonly ChangeRequest[], next: Decision, kind: ReviewKind): string {
  const pi = items[0]?.pi ?? 'PI';
  const ids = items.map((r) => r.id).join(', ');
  const [thanks, subject] =
    kind === 'change'
      ? ['Thanks for submitting a change request.', `Your requested changes (${ids})`]
      : ['Thanks for submitting your proposal.', `The configurations you requested (${ids})`];
  const outcome =
    next === 'APPROVED'
      ? `have been approved${kind === 'change' ? ' and applied to the affected observations' : ''}.`
      : 'have been denied. Please contact your contact scientist to discuss alternatives.';
  return `Dear ${pi},\n\n${thanks} ${subject} ${outcome}\n\nRegards,\nGemini Science Operations`;
}

/**
 * The per-configurationRequest approve/deny panel shared by the Change Requests
 * tab (sc-9094) and the Proposals tab's proposal review (sc-9595): a program's
 * requests may be approved or denied as a subset before the program is decided.
 * The reviewer selects requests, chooses Approve or Deny (which seeds a PI
 * response), and confirms — calling the real `updateConfigurationRequests`
 * mutation via `onResolve`.
 *
 * Selection, decision, and response are the reviewer's in-progress draft, so
 * they're owned here and reset whenever `resetKey` changes (a different program
 * selected) — a drafted decision can never carry to another program. The caller
 * passes the program id.
 */
export function ConfigurationRequestReview({
  requests,
  programLabel,
  programReference = programLabel,
  kind = 'change',
  title,
  controls,
  observationsById,
  resetKey,
  saving,
  onResolve,
}: {
  readonly requests: readonly ChangeRequest[];
  /** Program reference/id, shown in the panel titles. */
  readonly programLabel: string;
  /** The program as the outcome toast names it; defaults to `programLabel`. The
   *  Change Requests tab titles its tiles with the internal id but reports by
   *  reference. */
  readonly programReference?: string;
  /** Wording of the seeded response; see `ReviewKind`. */
  readonly kind?: ReviewKind;
  /** When given, the request table is wrapped in its own tile with this title
   *  and `controls`, sibling to the selected-requests tile below it. Left out
   *  where the caller already sits the table under its own heading. */
  readonly title?: string;
  readonly controls?: ReactNode;
  /** Resolves each request's observation ids to rows for the Target and Windows
   *  columns — a request carries only ids. */
  readonly observationsById: ReadonlyMap<string, ObservationRow>;
  /** Identifies the current request set; changing it resets the draft. */
  readonly resetKey: string;
  readonly saving: boolean;
  /** Records the decision on the given requests, with the PI response as the
   *  request's `feedback` (null when the reviewer cleared it, which leaves any
   *  stored response intact). Rejects when the mutation fails, which keeps the
   *  draft; the outcome is reported here, so callers need not. */
  readonly onResolve: (ids: readonly string[], status: Decision, response: string | null) => Promise<unknown>;
}): JSX.Element {
  const toast = useToast();

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [decision, setDecision] = useState<Decision | null>(null);
  const [response, setResponse] = useState('');

  // Scheduling windows for one request are shown on demand in an overlay,
  // grouped by the observation they belong to (sc-9621). A single panel is
  // reused; the click target sets which request's windows it shows.
  const windowsPanel = useRef<OverlayPanel>(null);
  const [windowsOf, setWindowsOf] = useState<readonly WindowGroup[]>([]);

  // Counts the draft resets, for a resolve that outlives the draft it was started
  // for (the reviewer moved to another program, even back again): its late
  // success must not clear the draft now showing.
  const [epoch, setEpoch] = useState(0);
  const latestEpoch = useRef(epoch);
  // A layout effect, so the ref is current before any promise can settle after
  // the render that reset the draft.
  useLayoutEffect(() => {
    latestEpoch.current = epoch;
  }, [epoch]);

  // Reset the draft whenever the request set changes, however it changes (a
  // facet hiding the selected program falls back to another, with no click).
  const [reviewedKey, setReviewedKey] = useState<string | null>(null);
  if (resetKey !== reviewedKey) {
    setReviewedKey(resetKey);
    setSelectedIds(new Set());
    setDecision(null);
    setResponse('');
    setWindowsOf([]);
    setEpoch((e) => e + 1);
  }

  const visibleRequests = useMemo<VisibleRequest[]>(
    () =>
      requests.map((r) => ({
        ...r,
        observations: r.observationIds.map((id) => observationsById.get(id)).filter(isNotNullish),
      })),
    [requests, observationsById],
  );
  const selectedRequests = visibleRequests.filter((r) => selectedIds.has(r.id));

  function choose(next: Decision): void {
    setDecision(next);
    setResponse(boilerplate(selectedRequests, next, kind));
  }

  async function confirm(): Promise<void> {
    if (!decision || selectedRequests.length === 0) return;
    const ids = selectedRequests.map((r) => r.id);
    // Choosing a decision seeds the boilerplate, so an empty box means the
    // reviewer cleared it deliberately: resolve without writing a response.
    const trimmed = response.trim();
    const startedAt = epoch;
    try {
      await onResolve(ids, decision, trimmed === '' ? null : trimmed);
    } catch (err) {
      toast.error('Update failed', friendlyError(err));
      return;
    }
    toast.success(
      `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${decision === 'APPROVED' ? 'approved' : 'denied'}`,
      `${ids.length} request${ids.length === 1 ? '' : 's'} in ${programReference}`,
    );
    if (latestEpoch.current !== startedAt) return;
    setSelectedIds(new Set());
    setDecision(null);
    setResponse('');
  }

  // What the requests are called where they are shown: a proposal's are its
  // configuration requests; on the Change Requests tab they are change requests.
  const singular = kind === 'change' ? 'change request' : 'configuration request';
  const noun = `${singular}s`;
  const titleNoun = noun.replace(/\b\w/g, (c) => c.toUpperCase());

  const requestTable = (
    <DataTable
      value={visibleRequests}
      dataKey="id"
      className="cr-review-table"
      // DataTable's own checkbox-selection column: a body-template Checkbox
      // never repainted its checkmark (memoized cells; reported as "checkmark
      // never appears").
      selectionMode="checkbox"
      selection={selectedRequests}
      onSelectionChange={(e) => setSelectedIds(new Set(e.value.map((r) => r.id)))}
      emptyMessage="No configuration requests to show."
    >
      <Column selectionMode="multiple" style={{ width: '2.5rem' }} />
      <Column field="id" header="ID" sortable style={{ width: '6rem' }} />
      <Column
        header="Received"
        style={{ width: '10rem' }}
        body={(r: ChangeRequest) => formatUtcMinute(r.createdAt)}
        headerTooltip="When the PI submitted the change request (UTC)."
      />
      <Column
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
        header="Observations"
        style={{ width: '8rem' }}
        body={(r: ChangeRequest) => r.observationIds.join(', ') || '—'}
      />
      <Column
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
        header="Justification"
        // The only column without a width, so the table squeezed it to a few
        // words per line and ran it into the status dot.
        style={{ minWidth: '16rem' }}
        body={(r: ChangeRequest) => truncate(r.justification, 60)}
        headerTooltip="The PI's justification for the change."
      />
      <Column
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
        // Staff may leave feedback before resolving, so this is not limited to
        // resolved requests.
        headerTooltip="Hover a request's status to see the response sent to the PI, when one has been given."
      />
    </DataTable>
  );

  return (
    <>
      {isNullish(title) ? (
        requestTable
      ) : (
        <Tile title={title} controls={controls} flush>
          {requestTable}
        </Tile>
      )}

      {selectedRequests.length > 0 && (
        <Tile title={`Selected ${titleNoun} in ${programLabel}`}>
          <p className="cr-selected-ids">{selectedRequests.map((r) => r.id).join(', ')}</p>

          <ConflictsTable title={`Potential Conflicts of the Selected ${titleNoun}`} sources={selectedRequests} />

          <DuplicatesTable
            title={`Potential Duplicate Observations of the Selected ${titleNoun}`}
            sources={selectedRequests}
          />

          <InputTextarea
            className={cn('cr-response', !decision && 'is-disabled')}
            rows={5}
            placeholder="Choose Approve or Deny to seed a response to the PI…"
            value={response}
            disabled={!decision}
            title={`The message sent to the PI, covering all selected ${noun}. Pre-filled with boilerplate; edit freely before confirming.`}
            onChange={(e) => setResponse(e.target.value)}
          />

          <div className="cr-actions">
            <Button
              label="Deny"
              icon={<XMark />}
              severity="danger"
              outlined={decision !== 'DENIED'}
              tooltip={`Mark every selected ${singular} as denied and seed a decline response.`}
              tooltipOptions={{ position: 'top' }}
              onClick={() => choose('DENIED')}
            />
            <Button
              label="Approve"
              icon={<Check />}
              severity="success"
              outlined={decision !== 'APPROVED'}
              tooltip={`Mark every selected ${singular} as approved and seed an approval response.`}
              tooltipOptions={{ position: 'top' }}
              onClick={() => choose('APPROVED')}
            />
            <span
              title={
                decision
                  ? 'Record the decision via updateConfigurationRequests, then reload from the ODB.'
                  : 'Choose Approve or Deny first.'
              }
            >
              <Button
                label="Confirm"
                icon={<PaperPlane />}
                disabled={!decision || saving}
                loading={saving}
                onClick={() => void confirm()}
              />
            </span>
          </div>
        </Tile>
      )}

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

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
