import './ChangeRequestsPage.css';

import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { type JSX, useMemo, useState } from 'react';

import { DataSourceBadge } from '@/components/DataSourceBadge';
import { Tile } from '@/components/Tile';
import { friendlyError } from '@/gql/errors';
import {
  groupChangeRequestsByProgram,
  mapChangeRequests,
  observationsByIdFrom,
  useChangeRequests,
  useProgramObservations,
  useResolveChangeRequests,
} from '@/gql/odb/changeRequests';
import type { ChangeRequest, ConfigurationRequestStatus, ProgramCrStatus, Site } from '@/gql/types';
import { exploreProgramUrl } from '@/lib/explore';

import { ConfigurationRequestReview } from '../review/ConfigurationRequestReview';

const EMPTY: ChangeRequest[] = [];

const STATUS_COLOR: Record<ProgramCrStatus, string> = {
  Approved: 'cr-status-approved',
  Denied: 'cr-status-denied',
  Open: 'cr-status-open',
  Mixed: 'cr-status-mixed',
};

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
 * The response is persisted as the request's `feedback` — the ODB's staff-side
 * counterpart to the PI's `justification` — and shown as a tooltip on the
 * status dot.
 */
export default function ChangeRequestsPage(): JSX.Element {
  const { data, loading, error } = useChangeRequests();
  const requests = useMemo(() => (data ? mapChangeRequests(data) : EMPTY), [data]);
  const { resolve, loading: saving } = useResolveChangeRequests();
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
          (site === ALL || p.sites.has(site)) &&
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
  // resolve them to real rows by loading the selected program's observations
  // (paginated — see useProgramObservations) and indexing by id, then looking
  // each request's ids up below. One program-scoped fetch, not a per-request
  // N+1 nor a giant id-list query.
  const { matches: programObservations } = useProgramObservations(selectedProgram?.programId ?? null);
  const observationsById = useMemo(() => observationsByIdFrom(programObservations), [programObservations]);

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
      <DataSourceBadge loading={loading} error={error && friendlyError(error)} empty={programs.length === 0} />
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
          onSelectionChange={(e) => setSelectedProgramId((e.value as { programId: string } | null)?.programId ?? null)}
          emptyMessage="No programs with change requests."
          className="cr-table"
        >
          <Column
            field="programReference"
            header="Program"
            sortable
            style={{ width: '13rem' }}
            headerTooltip="The program's reference label, linked to Explore (falls back to its internal id when no reference has been assigned)."
            body={(p: (typeof filteredPrograms)[number]) =>
              // A program with no reference falls back to its internal id, which
              // isn't a valid Explore path — show it as plain text (sc-10159).
              p.programReference === p.programId ? (
                p.programReference
              ) : (
                <a href={exploreProgramUrl(p.programReference)} target="_blank" rel="noreferrer">
                  {p.programReference}
                </a>
              )
            }
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
        <ConfigurationRequestReview
          requests={programRequests}
          programLabel={selectedProgram.programId}
          programReference={selectedProgram.programReference}
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
          observationsById={observationsById}
          resetKey={selectedProgram.programId}
          saving={saving}
          onResolve={resolve}
        />
      )}
    </>
  );
}

/** Pull the semester token out of a program reference ("G-2027B-1234-Q" →
 *  "2027B"). Programs without a reference fall back to their internal id,
 *  which has no semester — group those under "—". */
function semesterOf(programReference: string): string {
  const m = /-(\d{4}[AB])-/.exec(programReference);
  return m ? m[1]! : '—';
}
