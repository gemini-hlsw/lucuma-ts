/*
 * Proposals view (sc-9092): special-type proposals (Director's Time / Poor
 * Weather), reached via programs.proposal — the ODB scopes this to what the
 * token can see.
 */
import { useMutation, useQuery } from '@apollo/client/react';

import type { DocumentType } from './odb/gen';
import { graphql } from './odb/gen';
import { mapObservationRow } from './shared';
import type { Proposal, SpecialProposalType } from './types';

export const PROPOSALS_QUERY = graphql(`
  query AdminProposals {
    programs(LIMIT: 200) {
      matches {
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
        observations(LIMIT: 200) {
          matches {
            ...ObservationRowFields
          }
        }
      }
    }
  }
`);

export type AdminProposalsResult = DocumentType<typeof PROPOSALS_QUERY>;

const SPECIAL_SUBTYPES: Partial<Record<string, SpecialProposalType>> = {
  DIRECTORS_TIME: 'DIRECTORS_TIME',
  POOR_WEATHER: 'POOR_WEATHER',
};

/** Map programs that carry a special-type proposal into the Proposals view.
 *  A submitted-at timestamp has no ODB field (the same genuine gap as the
 *  Change Requests "received" timestamp) — omitted rather than faked. */
export function mapProposals(raw: AdminProposalsResult): Proposal[] {
  const out: Proposal[] = [];
  for (const p of raw.programs.matches) {
    const type = SPECIAL_SUBTYPES[p.proposal?.gemini?.scienceSubtype ?? ''];
    if (!p.proposal || !type) continue; // special proposals only
    const prof = p.pi?.user?.profile;
    const reference = p.proposal.reference?.label ?? p.id;
    out.push({
      id: p.id,
      reference,
      semester: semesterOfReference(reference),
      pi: [prof?.givenName, prof?.familyName].filter(Boolean).join(' ') || '(unknown PI)',
      title: p.name ?? '(untitled)',
      type,
      status: p.proposalStatus,
      abstract: p.description ?? '',
      observations: p.observations.matches.map(mapObservationRow),
    });
  }
  return out;
}

/** The special-proposals list — cached rows render immediately, refreshed in
 *  background. Accepting is multi-step (status + allocations + properties),
 *  so the page refetch()es once at the end rather than per mutation. */
export function useProposals() {
  return useQuery(PROPOSALS_QUERY, { fetchPolicy: 'cache-and-network' });
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
