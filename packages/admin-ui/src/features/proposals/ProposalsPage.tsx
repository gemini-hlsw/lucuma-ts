import { Chips } from 'primereact/chips';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { type JSX, useMemo, useState } from 'react';

import { DataSourceBadge } from '@/components/DataSourceBadge';
import { TimeAwardsGrid } from '@/components/TimeAwardsGrid';
import { useToast } from '@/components/toastContext';
import { friendlyError } from '@/gql/errors';
import type { ProgramPropertiesInput } from '@/gql/gen/graphql';
import { allocationsInput, useSetAllocations, useUpdateProgram } from '@/gql/programs';
import { mapProposals, useProposals, useSetProposalStatus } from '@/gql/proposals';
import {
  type Allocation,
  type Proposal,
  type ProposalStatus,
  SPECIAL_PROPOSAL_TYPE_LABEL,
  type SpecialProposalType,
} from '@/gql/types';

import { type Decision, type ReviewColumn, type ReviewItem, ReviewView } from '../review/ReviewView';

/** A proposal is "resolved" once a decision has been recorded. */
type ReviewProposal = Proposal & ReviewItem;

const COLUMNS: ReviewColumn<ReviewProposal>[] = [
  { header: 'Reference', value: (p) => p.reference, width: '12rem' },
  { header: 'Semester', value: (p) => p.semester, width: '7rem' },
  { header: 'PI', value: (p) => p.pi, width: '13rem' },
  { header: 'Type', value: (p) => SPECIAL_PROPOSAL_TYPE_LABEL[p.type], width: '12rem' },
  { header: 'Status', value: (p) => p.status, width: '11rem' },
  { header: 'Title', value: (p) => p.title },
];

const EMPTY: Proposal[] = [];

/** "Show everything" sentinel for the facet dropdowns (a real string — see the
 *  Change Requests view for why null option values misbehave in PrimeReact). */
const ALL = 'ALL';

const STATUS_OPTIONS: { label: string; value: ProposalStatus | typeof ALL }[] = [
  { label: 'All statuses', value: ALL },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Accepted', value: 'ACCEPTED' },
  { label: 'Not accepted', value: 'NOT_ACCEPTED' },
  { label: 'Not submitted', value: 'NOT_SUBMITTED' },
];

/** What the reviewer grants alongside acceptance, per Andy's updated sc-9092
 *  mockup: the Time Awards table plus active period, proprietary period, and
 *  contact scientists. */
interface AwardDraft {
  allocations: readonly Allocation[];
  activeStart: string;
  activeEnd: string;
  proprietaryMonths: number;
  contactScientists: readonly string[];
}

const BLANK_AWARD: AwardDraft = {
  allocations: [],
  activeStart: '',
  activeEnd: '',
  proprietaryMonths: 12,
  contactScientists: [],
};

/**
 * Proposals view (sc-9092): review & respond to special proposals — Director's
 * Time and Poor Weather. Built on the shared ReviewView with status / type /
 * semester facets. Accepting records the decision via setProposalStatus and
 * applies the reviewer's award (setAllocations + updatePrograms); rejecting
 * records NOT_ACCEPTED.
 */
export default function ProposalsPage(): JSX.Element {
  const toast = useToast();
  const { data, loading, error, refetch } = useProposals();
  const proposals = useMemo(() => (data ? mapProposals(data) : EMPTY), [data]);
  const [setProposalStatus, { loading: settingStatus }] = useSetProposalStatus();
  const [setAllocations, { loading: settingAllocations }] = useSetAllocations();
  const [updateProgram, { loading: updatingProgram }] = useUpdateProgram();
  const resolving = settingStatus || settingAllocations || updatingProgram;

  const [statusFilter, setStatusFilter] = useState<ProposalStatus | typeof ALL>(ALL);
  const [typeFilter, setTypeFilter] = useState<SpecialProposalType | typeof ALL>(ALL);
  const [semesterFilter, setSemesterFilter] = useState<string>(ALL);

  // A proposal is "resolved" once its status is a decided one.
  const items: ReviewProposal[] = useMemo(
    () =>
      proposals
        .filter(
          (p) =>
            (statusFilter === ALL || p.status === statusFilter) &&
            (typeFilter === ALL || p.type === typeFilter) &&
            (semesterFilter === ALL || p.semester === semesterFilter),
        )
        .map((p) => ({ ...p, resolved: p.status === 'ACCEPTED' || p.status === 'NOT_ACCEPTED' })),
    [proposals, statusFilter, typeFilter, semesterFilter],
  );
  const semesters = useMemo(() => Array.from(new Set(proposals.map((p) => p.semester))).sort(), [proposals]);

  // The award being drafted per proposal (keyed by program id). State, and
  // AwardForm renders from it, so the draft submitted at resolve time is
  // always exactly what's on screen — even across Accept/Reject toggles,
  // which unmount and remount the form.
  const [awards, setAwards] = useState<ReadonlyMap<string, AwardDraft>>(new Map());

  function boilerplate(p: ReviewProposal, decision: Decision): string {
    return decision === 'ACCEPT'
      ? `Dear ${p.pi},\n\nYour ${SPECIAL_PROPOSAL_TYPE_LABEL[p.type]} proposal "${p.title}" (${p.reference}) has been accepted. The observations will be added to the queue.\n\nRegards,\nGemini Science Operations`
      : `Dear ${p.pi},\n\nAfter review, your ${SPECIAL_PROPOSAL_TYPE_LABEL[p.type]} proposal "${p.title}" (${p.reference}) has not been accepted at this time.\n\nRegards,\nGemini Science Operations`;
  }

  /** Record the decision. Accept also applies the drafted award: allocations
   *  via setAllocations, active period + proprietary months via
   *  updatePrograms. Returns true when everything landed. */
  async function onResolve(p: ReviewProposal, decision: Decision): Promise<boolean> {
    try {
      if (decision === 'ACCEPT') {
        const award = awards.get(p.id) ?? BLANK_AWARD;
        const allocations = allocationsInput(award.allocations);
        const SET: ProgramPropertiesInput = {
          goa: { proprietaryMonths: award.proprietaryMonths },
          ...(award.activeStart ? { activeStart: award.activeStart } : {}),
          ...(award.activeEnd ? { activeEnd: award.activeEnd } : {}),
        };
        // Status first — it validates the proposal is decidable before any
        // program properties are touched.
        await setProposalStatus({ variables: { programId: p.id, status: 'ACCEPTED' } });
        if (allocations.length > 0) {
          await setAllocations({ variables: { programId: p.id, allocations } });
        }
        await updateProgram({ variables: { programId: p.id, SET } });
        toast.success('Proposal accepted', p.reference);
      } else {
        await setProposalStatus({ variables: { programId: p.id, status: 'NOT_ACCEPTED' } });
        toast.success('Proposal rejected', p.reference);
      }
      void refetch();
      return true;
    } catch (err) {
      toast.error('Resolve failed', friendlyError(err));
      return false;
    }
  }

  const controls = (
    <>
      <Dropdown
        value={statusFilter}
        options={STATUS_OPTIONS}
        onChange={(e) => setStatusFilter(e.value as ProposalStatus | typeof ALL)}
        title="Facet by proposal status — e.g. just the Submitted ones awaiting a decision."
      />
      <Dropdown
        value={typeFilter}
        options={[
          { label: 'All types', value: ALL },
          ...Object.entries(SPECIAL_PROPOSAL_TYPE_LABEL).map(([value, label]) => ({ label, value })),
        ]}
        onChange={(e) => setTypeFilter(e.value as SpecialProposalType | typeof ALL)}
        title="Facet by proposal type — Director's Time or Poor Weather."
      />
      <Dropdown
        value={semesterFilter}
        options={[{ label: 'All semesters', value: ALL }, ...semesters.map((s) => ({ label: s, value: s }))]}
        onChange={(e) => setSemesterFilter(e.value as string)}
        title="Facet by the semester in the proposal reference."
      />
    </>
  );

  return (
    <ReviewView<ReviewProposal>
      title="Proposals"
      blurb="Review & respond to Director’s Time and Poor Weather proposals."
      badge={<DataSourceBadge loading={loading} error={error && friendlyError(error)} empty={items.length === 0} />}
      controls={controls}
      resolving={resolving}
      items={items}
      columns={COLUMNS}
      noun="proposal"
      resolveMutation="setProposalStatus + setAllocations + updatePrograms"
      detailTitle={(p) => `${p.reference} · ${p.pi}`}
      renderDetail={(p) => (
        <>
          <dl>
            <dt>Reference</dt>
            <dd>{p.reference}</dd>
            <dt>PI</dt>
            <dd>{p.pi}</dd>
            <dt>Type</dt>
            <dd>{SPECIAL_PROPOSAL_TYPE_LABEL[p.type]}</dd>
          </dl>
          <p className="review-abstract">{p.abstract}</p>
        </>
      )}
      renderExtra={(p, decision) =>
        decision === 'ACCEPT' && (
          <AwardForm
            key={p.id}
            requestedHours={p.observations.reduce((s, o) => s + o.hours, 0)}
            award={awards.get(p.id) ?? BLANK_AWARD}
            onChange={(award) => setAwards((prev) => new Map(prev).set(p.id, award))}
          />
        )
      }
      boilerplate={boilerplate}
      onResolve={onResolve}
    />
  );
}

/** The acceptance award editor (sc-9092 mockup): Time Awards grid + active
 *  period, proprietary period, and contact scientists. Controlled — the page
 *  owns the draft, so it survives Accept/Reject toggles and is exactly what
 *  gets submitted at resolve time. */
function AwardForm({
  requestedHours,
  award,
  onChange,
}: {
  readonly requestedHours: number;
  readonly award: AwardDraft;
  readonly onChange: (award: AwardDraft) => void;
}): JSX.Element {
  function update(patch: Partial<AwardDraft>): void {
    onChange({ ...award, ...patch });
  }

  const awarded = award.allocations.reduce((s, a) => s + a.hours, 0);

  return (
    <section className="decision-panel">
      <h3 className="review-obs-title">Time Awards</h3>
      <p className="decision-hint">
        {requestedHours.toFixed(1)} hours requested · {awarded.toFixed(1)} awarded — enter each partner’s award by band.
      </p>
      <TimeAwardsGrid allocations={award.allocations} onChange={(a) => update({ allocations: a })} />

      <dl className="decision-fields">
        <dt>
          <label htmlFor="award-start" title="First day the accepted program is active (Program.activeStart).">
            Active Period
          </label>
        </dt>
        <dd className="award-period">
          <InputText
            id="award-start"
            value={award.activeStart}
            placeholder="YYYY-MM-DD"
            onChange={(e) => update({ activeStart: e.target.value })}
          />
          <span>–</span>
          <InputText
            value={award.activeEnd}
            placeholder="YYYY-MM-DD"
            onChange={(e) => update({ activeEnd: e.target.value })}
          />
        </dd>
        <dt>
          <label htmlFor="award-prop" title="Months the data stay proprietary (GOA proprietaryMonths).">
            Proprietary Period
          </label>
        </dt>
        <dd>
          <InputNumber
            inputId="award-prop"
            value={award.proprietaryMonths}
            min={0}
            max={36}
            suffix=" months"
            onValueChange={(e) => update({ proprietaryMonths: e.value ?? 0 })}
          />
        </dd>
        <dt>
          <label
            htmlFor="award-contacts"
            title="Contact scientists to assign. Assignment isn't sent yet — the ODB models contacts as ProgramUser rows needing a user id, which this list doesn't carry; see the Programs view."
          >
            Contact Scientists
          </label>
        </dt>
        <dd>
          <Chips
            inputId="award-contacts"
            value={[...award.contactScientists]}
            onChange={(e) => update({ contactScientists: e.value ?? [] })}
            placeholder="Add a contact…"
          />
        </dd>
      </dl>
    </section>
  );
}
