/*
 * Proposals view (sc-9092): special-type proposals (Director's Time / Poor
 * Weather), reached via programs.proposal — the ODB scopes this to what the
 * token can see.
 */
import { useMutation, useQuery } from '@apollo/client/react';

import type { Proposal, SpecialProposalType } from '../types';
import { useAllPages } from '../useAllPages';
import { graphql } from './gen';
import type { ProposalItemFragment, ScienceSubtype } from './gen/graphql';
import { isScienceObservation, mapObservationRow, telluricGroupHours } from './shared';

/** One special-type proposal's program row: who proposed what, with the
 *  observations and telluric groups whose estimates the Time column sums. */
export const PROPOSAL_ITEM_FRAGMENT = graphql(`
  fragment ProposalItem on Program {
    id
    name
    description
    proposalStatus
    pi {
      id
      user {
        id
        profile {
          givenName
          familyName
        }
      }
    }
    proposal {
      reference {
        label
      }
      gemini {
        scienceSubtype
      }
    }
    # A special proposal has a handful of observations, never near a page
    # limit, so this inner list needs no cursor of its own.
    observations(LIMIT: 200) {
      matches {
        ...ObservationItem
      }
    }
    # System telluric groups whose combined time rolls into their science
    # observation's "Time" (sc-9598).
    allGroupElements {
      ...GroupElementItem
    }
  }
`);

/** Only Director's Time and Poor Weather proposals, selected by the ODB.
 *
 *  Selecting them here is what keeps the tab alive: asked for every program,
 *  the ODB costs every observation of each and the request outlasts the
 *  router's limit, so the tab died with "the ODB is unreachable" (sc-10520).
 *
 *  There is no science-subtype filter on `WhereProposal`; the one on
 *  `WhereProgram.reference` only matches programs whose proposal was accepted, and
 *  the pending ones are what an admin acts on. So this filters on the call's type.
 *  That reaches the same proposals only while a proposal's subtype follows its
 *  call: one with no call, or filed under another call type, is not selected, and
 *  `mapProposals` cannot bring it back. (On dev the two agree: 55 programs, and the
 *  accepted ones found by subtype are a subset.)
 *
 *  Paged via the OFFSET cursor (sc-9589) so a page cap cannot truncate the list;
 *  `useAllPages` follows `hasMore` to the end. Past a single page the ODB's cursor
 *  can skip rows without any sign of it (see `useAllPages`); this list is far below
 *  that. */
export const PROPOSALS_QUERY = graphql(`
  query AdminProposals($offset: ProgramId) {
    programs(
      WHERE: { proposal: { call: { gemini: { type: { IN: [DIRECTORS_TIME, POOR_WEATHER] } } } } }
      OFFSET: $offset
    ) {
      matches {
        ...ProposalItem
      }
      hasMore
    }
  }
`);

const SPECIAL_SUBTYPES: Partial<Record<ScienceSubtype, SpecialProposalType>> = {
  DIRECTORS_TIME: 'DIRECTORS_TIME',
  POOR_WEATHER: 'POOR_WEATHER',
};

/** Map programs that carry a special-type proposal into the Proposals view.
 *  The query selects by call type, which is not the proposal's subtype, so the
 *  subtype is checked again here and a proposal under one of those calls with
 *  another subtype is dropped. A submitted-at timestamp has no ODB field (the
 *  same genuine gap as the Change Requests "received" timestamp) — omitted
 *  rather than faked. */
export function mapProposals(programs: readonly ProposalItemFragment[]): Proposal[] {
  const out: Proposal[] = [];
  for (const p of programs) {
    const subtype = p.proposal?.gemini?.scienceSubtype;
    const type = subtype ? SPECIAL_SUBTYPES[subtype] : undefined;
    if (!p.proposal || !type) continue; // special proposals only
    const prof = p.pi?.user?.profile;
    const reference = p.proposal.reference?.label ?? p.id;
    const groupHours = telluricGroupHours(p.allGroupElements);
    out.push({
      id: p.id,
      reference,
      semester: semesterOfReference(reference),
      pi: [prof?.givenName, prof?.familyName].filter(Boolean).join(' ') || '(unknown PI)',
      title: p.name ?? '(untitled)',
      type,
      status: p.proposalStatus,
      abstract: p.description ?? '',
      observations: p.observations.matches.filter(isScienceObservation).map((o) => mapObservationRow(o, groupHours)),
    });
  }
  return out;
}

/** The special-proposals list — cached rows render immediately, refreshed in
 *  background. Accepting is multi-step (status + allocations + properties),
 *  so the page refetch()es once at the end rather than per mutation. */
export function useProposals() {
  const result = useQuery(PROPOSALS_QUERY, {
    variables: { offset: null },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    // The ObservationItem digest is computed per observation; one that can't be
    // costed (a GHOST high-res target with no sky position, an observation with
    // no observing mode) comes back null with an entry in the response's
    // `errors`. Under the default policy 'none' that one warning discards the
    // whole result and blanks the tab (sc-10153); 'all' keeps the good rows.
    errorPolicy: 'all',
  });

  return useAllPages(result, 'programs');
}

export const SET_PROPOSAL_STATUS_MUTATION = graphql(`
  mutation AdminSetProposalStatus($programId: ProgramId!, $status: ProposalStatus!) {
    setProposalStatus(input: { programId: $programId, status: $status }) {
      program {
        id
      }
    }
  }
`);

/** Semester token of a proposal reference ("G-2027B-0123" → "2027B"); "—"
 *  for internal-id fallbacks that carry no semester. */
export function semesterOfReference(reference: string): string {
  const m = /-(\d{4}[AB])/.exec(reference);
  return m ? m[1]! : '—';
}

export function useSetProposalStatus() {
  return useMutation(SET_PROPOSAL_STATUS_MUTATION);
}
