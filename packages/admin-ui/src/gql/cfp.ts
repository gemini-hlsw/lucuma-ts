/*
 * Calls for Proposals view (sc-9098): codegen-typed query/mutations + the
 * mapper onto the view shape.
 *
 * CallForProposals is multi-observatory in the schema (gemini/keck/subaru
 * property blocks); this view manages the Gemini calls, so the mapper keeps
 * only matches with GeminiCallProperties and the editor writes them back
 * under `gemini` in CallForProposalsPropertiesInput.
 */
import { useMutation, useQuery } from '@apollo/client/react';

import type { DocumentType } from './gen';
import { graphql } from './gen';
import type { CallForProposalsPropertiesInput } from './gen/graphql';
import type { CallForProposals, SiteCoordinateLimits } from './types';

export const CFPS_QUERY = graphql(`
  query AdminCfps {
    callsForProposals(LIMIT: 50) {
      matches {
        id
        title
        semester
        active {
          start
          end
        }
        submissionDeadlineDefault
        partners {
          geminiPartner
          submissionDeadline
          submissionDeadlineOverride
        }
        gemini {
          type
          allowsNonPartnerPi
          nonPartnerDeadline
          proprietaryMonths
          instruments
          coordinateLimits {
            north {
              raStart {
                hours
              }
              raEnd {
                hours
              }
              decStart {
                degrees
              }
              decEnd {
                degrees
              }
            }
            south {
              raStart {
                hours
              }
              raEnd {
                hours
              }
              decStart {
                degrees
              }
              decEnd {
                degrees
              }
            }
          }
        }
      }
    }
  }
`);

/** The calls list — cached rows render immediately, refreshed in background. */
export function useCfps() {
  return useQuery(CFPS_QUERY, { fetchPolicy: 'cache-and-network' });
}

export type AdminCfpsResult = DocumentType<typeof CFPS_QUERY>;
type RawCfp = AdminCfpsResult['callsForProposals']['matches'][number];
type RawLimits = NonNullable<RawCfp['gemini']>['coordinateLimits']['north'];

/** Map CallForProposals rows onto the view shape. Non-Gemini calls (no
 *  `gemini` property block) are outside this view's scope and are dropped. */
export function mapCfps(raw: AdminCfpsResult): CallForProposals[] {
  return raw.callsForProposals.matches.flatMap((c) => {
    const gemini = c.gemini;
    if (!gemini) return [];
    const partnerDeadlines = c.partners.map((p) => p.submissionDeadline).filter((d): d is string => d !== null);
    const otherDeadlines = gemini.allowsNonPartnerPi && gemini.nonPartnerDeadline ? [gemini.nonPartnerDeadline] : [];
    return [
      {
        id: c.id,
        title: c.title,
        type: gemini.type,
        semester: c.semester,
        activeStart: c.active.start,
        activeEnd: c.active.end,
        // Open = today's date hasn't yet passed the latest submission deadline
        // across all participating partners (+ non-partner PIs, if allowed).
        active: isCallOpen([...partnerDeadlines, ...otherDeadlines]),
        allowsNonPartnerPi: gemini.allowsNonPartnerPi,
        proprietaryMonths: gemini.proprietaryMonths,
        defaultDeadline: c.submissionDeadlineDefault ?? '',
        north: mapCoordinateLimits(gemini.coordinateLimits.north),
        south: mapCoordinateLimits(gemini.coordinateLimits.south),
        // Enum values, not display labels — the editor checklist compares these
        // against the schema's Instrument enum (labels are render-time only).
        instruments: [...gemini.instruments],
        // Every participating partner, whether or not it overrides the default
        // deadline.
        partners: c.partners.map((p) => ({
          partner: p.geminiPartner,
          deadlineOverride: p.submissionDeadlineOverride ?? undefined,
        })),
      },
    ];
  });
}

function mapCoordinateLimits(limits: RawLimits): SiteCoordinateLimits {
  return {
    raStart: Number(limits.raStart.hours),
    raEnd: Number(limits.raEnd.hours),
    decStart: Number(limits.decStart.degrees),
    decEnd: Number(limits.decEnd.degrees),
  };
}

export const UPDATE_CFP_MUTATION = graphql(`
  mutation AdminUpdateCfp($id: CallForProposalsId!, $SET: CallForProposalsPropertiesInput!) {
    updateCallsForProposals(input: { WHERE: { id: { EQ: $id } }, SET: $SET }) {
      callsForProposals {
        id
      }
    }
  }
`);

export const CREATE_CFP_MUTATION = graphql(`
  mutation AdminCreateCfp($SET: CallForProposalsPropertiesInput!) {
    createCallForProposals(input: { SET: $SET }) {
      callForProposals {
        id
      }
    }
  }
`);

export function useUpdateCfp() {
  return useMutation(UPDATE_CFP_MUTATION, { refetchQueries: [CFPS_QUERY], awaitRefetchQueries: true });
}

export function useCreateCfp() {
  return useMutation(CREATE_CFP_MUTATION, { refetchQueries: [CFPS_QUERY], awaitRefetchQueries: true });
}

/** Serialize an edited call into `CallForProposalsPropertiesInput`. Also used
 *  verbatim by Copy (create-from-selected), so it must cover every editable
 *  field. `allowsNonPartnerPi` is derived by the ODB from the call type and is
 *  deliberately absent. */
export function cfpPropertiesInput(c: CallForProposals): CallForProposalsPropertiesInput {
  return {
    semester: c.semester,
    ...(c.title.trim() === '' ? {} : { title: c.title.trim() }),
    activeStart: c.activeStart,
    activeEnd: c.activeEnd,
    ...(c.defaultDeadline.trim() === '' ? {} : { submissionDeadlineDefault: c.defaultDeadline.trim() }),
    partners: c.partners.map((p) => ({
      geminiPartner: p.partner,
      ...(p.deadlineOverride ? { submissionDeadlineOverride: p.deadlineOverride } : {}),
    })),
    gemini: {
      type: c.type,
      proprietaryMonths: c.proprietaryMonths,
      coordinateLimits: {
        north: coordinateLimitsInput(c.north),
        south: coordinateLimitsInput(c.south),
      },
      instruments: [...c.instruments] as NonNullable<
        NonNullable<CallForProposalsPropertiesInput['gemini']>['instruments']
      >,
    },
  };
}

function coordinateLimitsInput(l: SiteCoordinateLimits) {
  return {
    raStart: { hours: l.raStart },
    raEnd: { hours: l.raEnd },
    decStart: { degrees: l.decStart },
    decEnd: { degrees: l.decEnd },
  };
}

/** Gemini semester containing the given moment: A runs Feb–Jul, B runs
 *  Aug–Jan (January belongs to the previous year's B). Seeds newly created
 *  calls. */
export function currentSemester(now: Date = new Date()): string {
  const month = now.getUTCMonth() + 1;
  if (month === 1) return `${String(now.getUTCFullYear() - 1)}B`;
  return `${String(now.getUTCFullYear())}${month < 8 ? 'A' : 'B'}`;
}

/** A semester's active date range — the ODB requires activeStart/activeEnd on
 *  create. A: Feb 1 – Aug 1; B: Aug 1 – Feb 1 of the next year. */
export function semesterDates(semester: string): { activeStart: string; activeEnd: string } {
  const year = Number(semester.slice(0, 4));
  return semester.endsWith('A')
    ? { activeStart: `${String(year)}-02-01`, activeEnd: `${String(year)}-08-01` }
    : { activeStart: `${String(year)}-08-01`, activeEnd: `${String(year + 1)}-02-01` };
}

/** A call is open while today is on or before the latest of its deadlines —
 *  it stays open until every participating partner's window has closed.
 *  No deadlines at all (e.g. a draft) is treated as not yet open. */
function isCallOpen(deadlines: readonly string[]): boolean {
  if (deadlines.length === 0) return false;
  const latest = Math.max(...deadlines.map((d) => new Date(d).getTime()));
  return Date.now() <= latest;
}
