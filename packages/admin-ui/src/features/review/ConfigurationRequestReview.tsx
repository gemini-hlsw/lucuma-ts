import './ConfigurationRequestReview.css';

import { Check, cn, isNullish, PaperPlane, useToastApi, XMark } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { type JSX, type ReactNode, useLayoutEffect, useRef, useState } from 'react';

import { ConflictsTable } from '@/components/ConflictsTable';
import { DuplicatesTable } from '@/components/DuplicatesTable';
import { Tile } from '@/components/Tile';
import { friendlyError } from '@/gql/errors';
import type { ChangeRequest, ObservationRow } from '@/gql/types';

import { ConfigurationRequestTable } from './ConfigurationRequestTable';

/** The reviewer's decision on a set of requests. */
export type Decision = 'APPROVED' | 'DENIED';

function boilerplate(items: readonly ChangeRequest[], next: Decision): string {
  const pi = items[0]?.pi ?? 'PI';
  const ids = items.map((r) => r.id).join(', ');
  const outcome =
    next === 'APPROVED'
      ? 'have been approved and applied to the affected observations.'
      : 'have been denied. Please contact your contact scientist to discuss alternatives.';
  return `Dear ${pi},\n\nThanks for submitting a change request. Your requested changes (${ids}) ${outcome}\n\nRegards,\nGemini Science Operations`;
}

/**
 * The per-configurationRequest approve/deny panel of the Change Requests tab
 * (sc-9094): the reviewer selects requests, chooses Approve or Deny (which seeds
 * a PI response), and confirms — calling the real `updateConfigurationRequests`
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
  const toast = useToastApi();

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [decision, setDecision] = useState<Decision | null>(null);
  const [response, setResponse] = useState('');

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
    setEpoch((e) => e + 1);
  }

  const selectedRequests = requests.filter((r) => selectedIds.has(r.id));

  function choose(next: Decision): void {
    setDecision(next);
    setResponse(boilerplate(selectedRequests, next));
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
      `Change requests ${decision === 'APPROVED' ? 'approved' : 'denied'}`,
      `${ids.length} request${ids.length === 1 ? '' : 's'} in ${programReference}`,
    );
    if (latestEpoch.current !== startedAt) return;
    setSelectedIds(new Set());
    setDecision(null);
    setResponse('');
  }

  const requestTable = (
    <ConfigurationRequestTable
      key={resetKey}
      requests={requests}
      observationsById={observationsById}
      selection={{ selectedIds, onChange: setSelectedIds }}
    />
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
        <Tile title={`Selected Change Requests in ${programLabel}`}>
          <p className="cr-selected-ids">{selectedRequests.map((r) => r.id).join(', ')}</p>

          <ConflictsTable title="Potential Conflicts of the Selected Change Requests" sources={selectedRequests} />

          <DuplicatesTable
            title="Potential Duplicate Observations of the Selected Change Requests"
            sources={selectedRequests}
          />

          <InputTextarea
            className={cn('cr-response', !decision && 'is-disabled')}
            rows={5}
            placeholder="Choose Approve or Deny to seed a response to the PI…"
            value={response}
            disabled={!decision}
            title="The message sent to the PI, covering all selected change requests. Pre-filled with boilerplate; edit freely before confirming."
            onChange={(e) => setResponse(e.target.value)}
          />

          <div className="cr-actions">
            <Button
              label="Deny"
              icon={<XMark />}
              severity="danger"
              outlined={decision !== 'DENIED'}
              tooltip="Mark every selected change request as denied and seed a decline response."
              tooltipOptions={{ position: 'top' }}
              onClick={() => choose('DENIED')}
            />
            <Button
              label="Approve"
              icon={<Check />}
              severity="success"
              outlined={decision !== 'APPROVED'}
              tooltip="Mark every selected change request as approved and seed an approval response."
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
    </>
  );
}
