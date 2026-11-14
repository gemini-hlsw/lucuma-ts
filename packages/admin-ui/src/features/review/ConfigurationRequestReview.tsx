import './ConfigurationRequestReview.css';

import { Check, cn, isNullish, PaperPlane, useToastApi, when, XMark } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { type JSX, type ReactNode, useState } from 'react';

import { ConflictsTable } from '@/components/ConflictsTable';
import { DuplicatesTable } from '@/components/DuplicatesTable';
import { Tile } from '@/components/Tile';
import { friendlyError } from '@/gql/errors';
import type { ChangeRequest, ConfigurationRequestStatus, ObservationRow } from '@/gql/types';

import { ConfigurationRequestTable } from './ConfigurationRequestTable';

/** The reviewer's decision on a set of requests. */
export type Decision = Extract<ConfigurationRequestStatus, 'APPROVED' | 'DENIED'>;

/** The reviewer's work in progress on one request set. */
interface Draft {
  /** The `resetKey` it was opened for. */
  readonly key: string;
  /** Distinguishes reopenings of the same program. */
  readonly opened: symbol;
  readonly selectedIds: ReadonlySet<string>;
  readonly decision: Decision | null;
  readonly response: string;
}

const openDraft = (key: string): Draft => ({
  key,
  opened: Symbol(key),
  selectedIds: new Set(),
  decision: null,
  response: '',
});

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

  // Reset on any change of request set, including a facet's silent fallback.
  const [draft, setDraft] = useState(() => openDraft(resetKey));
  if (draft.key !== resetKey) setDraft(openDraft(resetKey));
  const { selectedIds, decision, response } = draft;

  const selectedRequests = requests.filter((r) => selectedIds.has(r.id));

  function choose(next: Decision): void {
    setDraft((d) => ({ ...d, decision: next, response: boilerplate(selectedRequests, next) }));
  }

  async function confirm(): Promise<void> {
    if (!decision || selectedRequests.length === 0) return;
    const ids = selectedRequests.map((r) => r.id);
    // Choosing a decision seeds the boilerplate, so an empty box means the
    // reviewer cleared it deliberately: resolve without writing a response.
    const trimmed = response.trim();
    const { opened } = draft;
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
    // A late success must not clear a newer draft.
    setDraft((d) => (d.opened === opened ? openDraft(d.key) : d));
  }

  const requestTable = (
    <ConfigurationRequestTable
      key={resetKey}
      requests={requests}
      observationsById={observationsById}
      selection={{ selectedIds, onChange: (ids) => setDraft((d) => ({ ...d, selectedIds: ids })) }}
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

      {when(selectedRequests.length > 0, () => (
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
            onChange={(e) => setDraft((d) => ({ ...d, response: e.target.value }))}
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
      ))}
    </>
  );
}
