/*
 * Calls for Proposals view (sc-9098): codegen-typed query/mutations + the
 * mapper onto the view shape.
 *
 * CallForProposals is multi-observatory in the schema (gemini/keck/subaru
 * property blocks, exactly one non-null). This view handles all three: the
 * mapper tags each call with its observatory (sc-9608), and the editor writes
 * the matching block back in CallForProposalsPropertiesInput.
 */
import { useMutation, useQuery } from '@apollo/client/react';
import { parseNumber } from '@gemini-hlsw/lucuma-common-ui';

import { currentSemester } from '@/lib/semester';

import type { CallForProposals, CfpDetails, Observatory, SiteCoordinateLimits } from '../types';
import type { DocumentType } from './gen';
import { graphql } from './gen';
import type { CallForProposalsItemFragment, CallForProposalsPropertiesInput, SiteLimitFragment } from './gen/graphql';

// Re-exported for callers that already import it from this module (the CfP
// New-button seed uses it); the implementation lives in lib/semester.
export { currentSemester };

export const CFP_ITEM_FRAGMENT = graphql(`
  fragment CallForProposalsItem on CallForProposals {
    id
    existence
    title
    semester
    observatory
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
      exchangePartners {
        exchangePartner
        submissionDeadline
        submissionDeadlineOverride
      }
      coordinateLimits {
        north {
          ...SiteLimit
        }
        south {
          ...SiteLimit
        }
      }
    }
    keck {
      instruments
      coordinateLimits {
        ...SiteLimit
      }
    }
    subaru {
      type
      instruments
      coordinateLimits {
        ...SiteLimit
      }
    }
  }
`);

/** One site's RA/Dec window, shared by Gemini's two sites and the single-site
 *  Keck/Subaru limits (sc-9608). */
export const SITE_LIMIT_FRAGMENT = graphql(`
  fragment SiteLimit on CoordinateLimits {
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
`);

export const CFPS_QUERY = graphql(`
  query AdminCfps {
    # includeDeleted so DELETED (invisible) calls are fetchable — the
    # "Invisible" facet (sc-9612) needs them; visibility is filtered client-side
    # from each call's existence (WhereCallForProposals has no existence field).
    callsForProposals(LIMIT: 50, includeDeleted: true) {
      matches {
        ...CallForProposalsItem
      }
    }
  }
`);

/** The calls list — cached rows render immediately, refreshed in background. */
export function useCfps() {
  return useQuery(CFPS_QUERY, { fetchPolicy: 'cache-and-network' });
}

export type AdminCfpsResult = DocumentType<typeof CFPS_QUERY>;
type RawCall = CallForProposalsItemFragment;
type RawLimits = SiteLimitFragment;

/** Map CallForProposals rows onto the view shape, one row per call regardless
 *  of observatory (sc-9608). The observatory-specific block (gemini/keck/subaru)
 *  becomes the discriminated `details`; the ODB guarantees exactly one is set. */
export function mapCfps(raw: AdminCfpsResult): CallForProposals[] {
  return raw.callsForProposals.matches.map((c) => ({
    id: c.id,
    visible: c.existence === 'PRESENT',
    title: c.title,
    semester: c.semester,
    activeStart: c.active.start,
    activeEnd: c.active.end,
    // Open = today's date hasn't yet passed the latest submission deadline
    // across all participating partners (+ non-partner PIs, where Gemini allows).
    active: isCallOpen(callDeadlines(c)),
    defaultDeadline: c.submissionDeadlineDefault ?? '',
    // Every participating partner, whether or not it overrides the default.
    partners: c.partners.map((p) => ({
      partner: p.geminiPartner,
      deadlineOverride: p.submissionDeadlineOverride ?? undefined,
    })),
    details: mapDetails(c),
  }));
}

/** The observatory-specific `details` for a call. Exactly one of the three
 *  blocks is non-null (ODB invariant); a call with none would be a schema
 *  violation, so we surface it loudly rather than guess. */
function mapDetails(c: RawCall): CfpDetails {
  if (c.gemini) {
    return {
      observatory: 'GEMINI',
      type: c.gemini.type,
      proprietaryMonths: c.gemini.proprietaryMonths,
      allowsNonPartnerPi: c.gemini.allowsNonPartnerPi,
      // Enum values, not display labels — the editor checklist compares these
      // against the schema enum (labels are render-time only).
      instruments: [...c.gemini.instruments],
      // Exchange partners participating in this Gemini call (sc-9610), mapped
      // like the regular partners above.
      exchangePartners: c.gemini.exchangePartners.map((p) => ({
        partner: p.exchangePartner,
        deadlineOverride: p.submissionDeadlineOverride ?? undefined,
      })),
      north: mapLimits(c.gemini.coordinateLimits.north),
      south: mapLimits(c.gemini.coordinateLimits.south),
    };
  }
  if (c.keck) {
    return { observatory: 'KECK', instruments: [...c.keck.instruments], limits: mapLimits(c.keck.coordinateLimits) };
  }
  if (c.subaru) {
    return {
      observatory: 'SUBARU',
      type: c.subaru.type,
      instruments: [...c.subaru.instruments],
      limits: mapLimits(c.subaru.coordinateLimits),
    };
  }
  throw new Error(`CallForProposals ${c.id} (${c.observatory}) has no observatory properties`);
}

/** The submission deadlines that determine open-ness: each partner's, plus the
 *  Gemini non-partner-PI deadline when that call allows non-partner PIs. */
function callDeadlines(c: RawCall): string[] {
  const partnerDeadlines = c.partners.map((p) => p.submissionDeadline).filter((d): d is string => d !== null);
  // Exchange partners (Keck/Subaru) participate in Gemini calls too (sc-9610),
  // so their windows keep the call open just like the regular partners'.
  const exchangeDeadlines =
    c.gemini?.exchangePartners.map((p) => p.submissionDeadline).filter((d): d is string => d !== null) ?? [];
  const nonPartner = c.gemini?.allowsNonPartnerPi && c.gemini.nonPartnerDeadline ? [c.gemini.nonPartnerDeadline] : [];
  return [...partnerDeadlines, ...exchangeDeadlines, ...nonPartner];
}

function mapLimits(limits: RawLimits): SiteCoordinateLimits {
  return {
    raStart: parseNumber(limits.raStart.hours),
    raEnd: parseNumber(limits.raEnd.hours),
    decStart: parseNumber(limits.decStart.degrees),
    decEnd: parseNumber(limits.decEnd.degrees),
  };
}

export const UPDATE_CFP_MUTATION = graphql(`
  mutation AdminUpdateCfp($id: CallForProposalsId!, $set: CallForProposalsPropertiesInput!) {
    # includeDeleted so an already-invisible call can be edited/restored — the
    # update WHERE, like the query, otherwise skips DELETED rows, so toggling
    # Visible back on would silently match nothing (sc-9612).
    updateCallsForProposals(input: { WHERE: { id: { EQ: $id } }, includeDeleted: true, SET: $set }) {
      callsForProposals {
        id
      }
    }
  }
`);

export const CREATE_CFP_MUTATION = graphql(`
  mutation AdminCreateCfp($set: CallForProposalsPropertiesInput!) {
    createCallForProposals(input: { SET: $set }) {
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
 *  field. Emits exactly the one observatory block the call belongs to — the ODB
 *  requires exactly one of gemini/keck/subaru (sc-9608). `allowsNonPartnerPi` is
 *  derived by the ODB from the call type and is deliberately absent. */
export function cfpPropertiesInput(c: CallForProposals): CallForProposalsPropertiesInput {
  return {
    // Visibility (sc-9612): PRESENT keeps the call, DELETED soft-deletes it.
    existence: c.visible ? 'PRESENT' : 'DELETED',
    semester: c.semester,
    ...(c.title.trim() === '' ? {} : { title: c.title.trim() }),
    activeStart: c.activeStart,
    activeEnd: c.activeEnd,
    ...(c.defaultDeadline.trim() === '' ? {} : { submissionDeadlineDefault: c.defaultDeadline.trim() }),
    partners: c.partners.map((p) => ({
      geminiPartner: p.partner,
      ...(p.deadlineOverride ? { submissionDeadlineOverride: p.deadlineOverride } : {}),
    })),
    ...observatoryInput(c.details),
  };
}

/** The single observatory block for the properties input — the discriminant
 *  chooses which of gemini/keck/subaru is set. The full instrument list is sent
 *  (as the ODB expects for an edit); an empty checklist stores an empty list. */
function observatoryInput(d: CfpDetails): Pick<CallForProposalsPropertiesInput, 'gemini' | 'keck' | 'subaru'> {
  switch (d.observatory) {
    case 'GEMINI':
      return {
        gemini: {
          type: d.type,
          proprietaryMonths: d.proprietaryMonths,
          coordinateLimits: { north: coordinateLimitsInput(d.north), south: coordinateLimitsInput(d.south) },
          instruments: [...d.instruments],
          exchangePartners: d.exchangePartners.map((p) => ({
            exchangePartner: p.partner,
            ...(p.deadlineOverride ? { submissionDeadlineOverride: p.deadlineOverride } : {}),
          })),
        },
      };
    case 'KECK':
      return { keck: { instruments: [...d.instruments], coordinateLimits: coordinateLimitsInput(d.limits) } };
    case 'SUBARU':
      return {
        subaru: {
          type: d.type,
          instruments: [...d.instruments],
          coordinateLimits: coordinateLimitsInput(d.limits),
        },
      };
  }
}

function coordinateLimitsInput(l: SiteCoordinateLimits) {
  return {
    raStart: { hours: l.raStart },
    raEnd: { hours: l.raEnd },
    decStart: { degrees: l.decStart },
    decEnd: { degrees: l.decEnd },
  };
}

/** A semester's active date range — the ODB requires activeStart/activeEnd on
 *  create. A: Feb 1 – Aug 1; B: Aug 1 – Feb 1 of the next year. */
export function semesterDates(semester: string): { activeStart: string; activeEnd: string } {
  const year = parseNumber(semester.slice(0, 4));
  return semester.endsWith('A')
    ? { activeStart: `${String(year)}-02-01`, activeEnd: `${String(year)}-08-01` }
    : { activeStart: `${String(year)}-08-01`, activeEnd: `${String(year + 1)}-02-01` };
}

/** The minimal create input for a brand-new call at the given observatory
 *  (sc-9608). Only the create-required fields are set — semester, active dates,
 *  and the one observatory block; the ODB fills in the rest (coordinate limits
 *  from the active period, all instruments, default proprietary period, and
 *  Subaru type NORMAL). Gemini's call type has no default, so it's seeded. */
export function newCallInput(observatory: Observatory): CallForProposalsPropertiesInput {
  const semester = currentSemester();
  const block: Pick<CallForProposalsPropertiesInput, 'gemini' | 'keck' | 'subaru'> =
    observatory === 'GEMINI'
      ? { gemini: { type: 'REGULAR_SEMESTER' } }
      : observatory === 'KECK'
        ? { keck: {} }
        : { subaru: {} };
  return { semester, ...semesterDates(semester), ...block };
}

/** A call is open while today is on or before the latest of its deadlines —
 *  it stays open until every participating partner's window has closed.
 *  No deadlines at all (e.g. a draft) is treated as not yet open. */
function isCallOpen(deadlines: readonly string[]): boolean {
  if (deadlines.length === 0) return false;
  const latest = Math.max(...deadlines.map((d) => new Date(d).getTime()));
  return Date.now() <= latest;
}
