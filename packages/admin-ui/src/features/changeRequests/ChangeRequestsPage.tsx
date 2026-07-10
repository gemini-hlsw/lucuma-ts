import './ChangeRequestsPage.css';

import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputTextarea } from 'primereact/inputtextarea';
import { type JSX, useMemo, useState } from 'react';

import { ConflictsTable } from '@/components/ConflictsTable';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { DuplicatesTable } from '@/components/DuplicatesTable';
import { Tile } from '@/components/Tile';
import { useToast } from '@/components/toastContext';
import {
  CHANGE_REQUESTS_QUERY,
  groupChangeRequestsByProgram,
  mapChangeRequests,
  mapObservationsById,
  OBSERVATIONS_BY_ID_QUERY,
  UPDATE_CONFIGURATION_REQUESTS_MUTATION,
} from '@/gql/changeRequests';
import type { ChangeRequest, ConfigurationRequestStatus, ObservationRow, ProgramCrStatus, Site } from '@/gql/types';
import { useOdbData, useOdbDataByIds, useOdbMutation } from '@/gql/useOdbData';

const EMPTY: ChangeRequest[] = [];

const STATUS_COLOR: Record<ProgramCrStatus, string> = {
  Approved: 'cr-status-approved',
  Denied: 'cr-status-denied',
  Open: 'cr-status-open',
  Mixed: 'cr-status-mixed',
};

const CR_STATUS_ICON: Record<ConfigurationRequestStatus, string> = {
  REQUESTED: 'cr-dot-open',
  APPROVED: 'cr-dot-approved',
  DENIED: 'cr-dot-denied',
  WITHDRAWN: 'cr-dot-denied',
};

type Decision = 'APPROVED' | 'DENIED';

/** "Show everything" sentinel for the facet dropdowns. A real string, not
 *  null: PrimeReact's Dropdown hands back the whole option object for
 *  null-valued options, which silently matched nothing (Andy's "All shows an
 *  empty list" / "Both Sites is empty" notes). */
const ALL = 'ALL';

/**
 * Change Requests view (sc-9094): a program → request master-detail layout.
 * Top table is programs with a synthesized Status (Approved/Denied/Open/Mixed
 * across that program's requests); selecting one shows its individual
 * ConfigurationRequests with multi-select and a single response sent to the
 * PI. Approve/deny calls the real updateConfigurationRequests mutation, then
 * reloads from the ODB.
 *
 * Two ODB schema gaps surfaced honestly rather than hidden: CR-received
 * timestamps aren't tracked (the "Received" column says so), and there's no
 * reviewer-justification field (the resolve response is kept for the session
 * and shown as a tooltip on the status dot instead).
 */
export default function ChangeRequestsPage(): JSX.Element {
  const toast = useToast();
  const { data: requests, status, error, refetch } = useOdbData(CHANGE_REQUESTS_QUERY, mapChangeRequests, EMPTY);
  const mutate = useOdbMutation();
  const [saving, setSaving] = useState(false);
  const programs = useMemo(() => groupChangeRequestsByProgram(requests), [requests]);

  const [semester, setSemester] = useState<string>(ALL);
  const [site, setSite] = useState<Site | typeof ALL>(ALL);
  const [statusFilter, setStatusFilter] = useState<ProgramCrStatus | typeof ALL>(ALL);

  const semesters = useMemo(
    () => Array.from(new Set(programs.map((p) => semesterOf(p.programReference)))).sort(),
    [programs],
  );
  const filteredPrograms = useMemo(
    () =>
      programs.filter(
        (p) =>
          (semester === ALL || semesterOf(p.programReference) === semester) &&
          (site === ALL || p.site === site) &&
          (statusFilter === ALL || p.status === statusFilter),
      ),
    [programs, semester, site, statusFilter],
  );

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const selectedProgram =
    filteredPrograms.find((p) => p.programId === selectedProgramId) ?? filteredPrograms[0] ?? null;

  const [crStatusFilter, setCrStatusFilter] = useState<ConfigurationRequestStatus | typeof ALL>(ALL);
  const programRequests = useMemo(
    () => (selectedProgram?.requests ?? []).filter((r) => crStatusFilter === ALL || r.status === crStatusFilter),
    [selectedProgram, crStatusFilter],
  );

  // ConfigurationRequest only carries observation IDs (applicableObservations);
  // resolve them to real rows with one batched query per selected program,
  // not per request — avoids an N+1 fetch as the reviewer drills in.
  const observationIds = useMemo(
    () => Array.from(new Set(programRequests.flatMap((r) => r.observationIds))),
    [programRequests],
  );
  const { data: observationsById } = useOdbDataByIds(observationIds, OBSERVATIONS_BY_ID_QUERY, mapObservationsById);
  const visibleRequests = useMemo(
    () =>
      programRequests.map((r) => ({
        ...r,
        observations: r.observationIds
          .map((id) => observationsById.get(id))
          .filter((o): o is ObservationRow => o !== undefined),
      })),
    [programRequests, observationsById],
  );

  // DataTable's own checkbox-selection column (a body-template Checkbox never
  // repainted its checkmark — memoized cells; Andy's "checkmark never appears").
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const selectedRequests = visibleRequests.filter((r) => selectedIds.has(r.id));

  const [response, setResponse] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);

  // The reviewer's response, kept per-request so it can be shown as a status
  // tooltip (per the sc-9094 mockup note: "could be in a tool-tip on the
  // status"). There's no reviewer-justification field in the ODB yet — this
  // is session-only and lost on reload.
  const [reviewerNotes, setReviewerNotes] = useState<ReadonlyMap<string, string>>(new Map());

  function selectProgram(id: string | null): void {
    setSelectedProgramId(id);
    setSelectedIds(new Set());
    setDecision(null);
    setResponse('');
  }

  function boilerplate(items: readonly ChangeRequest[], next: Decision): string {
    const pi = items[0]?.pi ?? 'PI';
    const ids = items.map((r) => r.id).join(', ');
    return next === 'APPROVED'
      ? `Dear ${pi},\n\nThanks for submitting a change request. Your requested changes (${ids}) have been approved and applied to the affected observations.\n\nRegards,\nGemini Science Operations`
      : `Dear ${pi},\n\nThanks for submitting a change request. Your requested changes (${ids}) have been denied. Please contact your contact scientist to discuss alternatives.\n\nRegards,\nGemini Science Operations`;
  }

  function choose(next: Decision): void {
    setDecision(next);
    setResponse(boilerplate(selectedRequests, next));
  }

  async function confirm(): Promise<void> {
    if (!decision || selectedRequests.length === 0) return;
    const ids = selectedRequests.map((r) => r.id);
    setSaving(true);
    try {
      await mutate(UPDATE_CONFIGURATION_REQUESTS_MUTATION, { ids, status: decision });
      toast.success(
        decision === 'APPROVED' ? 'Change requests approved' : 'Change requests denied',
        `${ids.length} request${ids.length === 1 ? '' : 's'} in ${selectedProgram?.programReference ?? ''}`,
      );
      setReviewerNotes((prev) => {
        const next = new Map(prev);
        for (const id of ids) next.set(id, response);
        return next;
      });
      setSelectedIds(new Set());
      setDecision(null);
      setResponse('');
      refetch();
    } catch (err) {
      toast.error('Update failed', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const tileControls = (
    <>
      <Dropdown
        value={semester}
        options={[{ label: 'All semesters', value: ALL }, ...semesters.map((s) => ({ label: s, value: s }))]}
        onChange={(e) => setSemester(e.value as string)}
        title="Filter programs by semester, parsed from the program reference."
      />
      <Dropdown
        value={site}
        options={[
          { label: 'Both sites', value: ALL },
          { label: 'North', value: 'NORTH' },
          { label: 'South', value: 'SOUTH' },
        ]}
        onChange={(e) => setSite(e.value as Site | typeof ALL)}
        title="Programs are site-agnostic, but their change requests are for individual observations tied to an instrument — filter by that instrument's site."
      />
      <Dropdown
        value={statusFilter}
        options={[
          { label: 'All statuses', value: ALL },
          { label: 'Approved', value: 'Approved' },
          { label: 'Denied', value: 'Denied' },
          { label: 'Open', value: 'Open' },
          { label: 'Mixed', value: 'Mixed' },
        ]}
        onChange={(e) => setStatusFilter(e.value as ProgramCrStatus | typeof ALL)}
        title="Facet the programs by their synthesized change-request status."
      />
      <DataSourceBadge status={status} error={error} empty={programs.length === 0} />
    </>
  );

  return (
    <>
      <Tile title="Programs with Change Requests" controls={tileControls} flush>
        <p className="cr-blurb">
          Review and respond to configuration-change requests from PIs. Select a program below to see its individual
          requests.
        </p>
        <DataTable
          value={filteredPrograms}
          dataKey="programId"
          selectionMode="single"
          selection={selectedProgram ?? undefined}
          onSelectionChange={(e) => selectProgram((e.value as { programId: string } | null)?.programId ?? null)}
          emptyMessage="No programs with change requests."
          className="cr-table"
        >
          <Column
            field="programReference"
            header="Program"
            sortable
            style={{ width: '13rem' }}
            headerTooltip="The program's reference label (falls back to its internal id when no reference has been assigned)."
          />
          <Column
            header="Status"
            sortable
            sortField="status"
            style={{ width: '9rem' }}
            headerTooltip="Approved: all requests approved. Denied: all denied. Open: at least one still awaiting a decision. Mixed: a mix of approved and denied. Facet with the status dropdown above."
            body={(p: (typeof filteredPrograms)[number]) => (
              <span className={cn('cr-status-pill', STATUS_COLOR[p.status])}>{p.status}</span>
            )}
          />
          <Column field="pi" header="PI" sortable style={{ width: '13rem' }} />
          <Column field="programTitle" header="Title" sortable />
        </DataTable>
      </Tile>

      {selectedProgram && (
        <Tile
          title={`Change Requests in ${selectedProgram.programId}`}
          controls={
            <Dropdown
              value={crStatusFilter}
              options={[
                { label: 'All', value: ALL },
                { label: 'Requested', value: 'REQUESTED' },
                { label: 'Approved', value: 'APPROVED' },
                { label: 'Denied', value: 'DENIED' },
                { label: 'Withdrawn', value: 'WITHDRAWN' },
              ]}
              onChange={(e) => setCrStatusFilter(e.value as ConfigurationRequestStatus | typeof ALL)}
              title="Filter the requests below by their individual status."
            />
          }
          flush
        >
          <DataTable
            value={visibleRequests}
            dataKey="id"
            className="cr-table"
            selectionMode="checkbox"
            selection={selectedRequests}
            onSelectionChange={(e) => setSelectedIds(new Set(e.value.map((r) => r.id)))}
          >
            <Column selectionMode="multiple" style={{ width: '2.5rem' }} />
            <Column field="id" header="ID" sortable style={{ width: '6rem' }} />
            <Column
              header="Received"
              style={{ width: '8rem' }}
              body={() => <span className="cr-untracked">not yet tracked</span>}
              headerTooltip="The date a change request was received isn't tracked by the ODB yet — a known sc-9094 gap."
            />
            <Column
              header="Target"
              style={{ width: '7rem' }}
              body={() => '—'}
              headerTooltip="No target name is tracked by the ODB — only coordinates are available (see RA/Dec)."
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
              header="Justification"
              body={(r: ChangeRequest) => truncate(r.justification, 60)}
              headerTooltip="The PI's justification for the change."
            />
            <Column
              header="Status"
              style={{ width: '5rem' }}
              body={(r: ChangeRequest) => {
                const note = reviewerNotes.get(r.id);
                const label =
                  r.status === 'REQUESTED'
                    ? 'Pending'
                    : r.status === 'APPROVED'
                      ? 'Approved'
                      : r.status === 'DENIED'
                        ? 'Denied'
                        : 'Withdrawn';
                return (
                  <span
                    className={cn('cr-dot', CR_STATUS_ICON[r.status])}
                    title={note ? `${label} — reviewer response: ${note}` : label}
                  />
                );
              }}
              headerTooltip="Hover a resolved request's status to see the reviewer's response — there's no dedicated reviewer-justification field in the ODB yet, so it's kept here for this session only."
            />
          </DataTable>
        </Tile>
      )}

      {selectedProgram && selectedRequests.length > 0 && (
        <Tile title={`Selected Change Requests in ${selectedProgram.programId}`}>
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
              icon="pi pi-times"
              severity="danger"
              outlined={decision !== 'DENIED'}
              tooltip="Mark every selected change request as denied and seed a decline response."
              tooltipOptions={{ position: 'top' }}
              onClick={() => choose('DENIED')}
            />
            <Button
              label="Approve"
              icon="pi pi-check"
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
                icon="pi pi-send"
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

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Pull the semester token out of a program reference ("G-2027B-1234-Q" →
 *  "2027B"). Programs without a reference fall back to their internal id,
 *  which has no semester — group those under "—". */
function semesterOf(programReference: string): string {
  const m = /-(\d{4}[AB])-/.exec(programReference);
  return m ? m[1]! : '—';
}
