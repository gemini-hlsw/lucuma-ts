/*
 * Proposals view (sc-9092): special-type proposals (Director's Time / Poor
 * Weather), reached via programs.proposal — the ODB scopes this to what the
 * token can see.
 */
import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect } from 'react';

import type { Proposal, SpecialProposalType } from '../types';
import type { DocumentType } from './gen';
import { graphql } from './gen';
import type { ScienceSubtype } from './gen/graphql';
import { isScienceObservation, mapObservationRow, telluricGroupHours } from './shared';

export const PROPOSALS_QUERY = graphql(`
  query AdminProposals($offset: ProgramId) {
    # Paged via the OFFSET cursor (sc-9589): the special-type filter runs
    # client-side (in mapProposals), so a fixed LIMIT truncated the program
    # list *before* filtering — dropping Director's Time / Poor Weather
    # proposals past the first page. useProposals follows hasMore to the end.
    programs(OFFSET: $offset) {
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
      hasMore
    }
  }
`);

export type AdminProposalsResult = DocumentType<typeof PROPOSALS_QUERY>;

const SPECIAL_SUBTYPES: Partial<Record<ScienceSubtype, SpecialProposalType>> = {
  DIRECTORS_TIME: 'DIRECTORS_TIME',
  POOR_WEATHER: 'POOR_WEATHER',
};

/** Map programs that carry a special-type proposal into the Proposals view.
 *  A submitted-at timestamp has no ODB field (the same genuine gap as the
 *  Change Requests "received" timestamp) — omitted rather than faked. */
export function mapProposals(raw: AdminProposalsResult): Proposal[] {
  const out: Proposal[] = [];
  for (const p of raw.programs.matches) {
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
  });

  const { data, fetchMore } = result;

  // Walk the remaining pages: each fetchMore appends the next page's matches
  // (merged via updateQuery, since the cache has no field policy for this list),
  // using the last loaded id as the cursor, until the ODB reports no more.
  useEffect(() => {
    if (!data?.programs.hasMore || fetchMore === undefined) return;
    const matches = data.programs.matches;
    const cursor = matches[matches.length - 1]?.id;
    if (cursor === undefined) return;
    void fetchMore({
      variables: { offset: cursor },
      updateQuery: (prev, { fetchMoreResult }) => ({
        programs: {
          ...fetchMoreResult.programs,
          matches: [...prev.programs.matches, ...fetchMoreResult.programs.matches],
        },
      }),
    });
  }, [data, fetchMore]);

  return {
    ...result,
    // Not settled until every page is in, so callers don't render a partial set.
    loading: result.loading || (data?.programs.hasMore ?? false),
  };
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
