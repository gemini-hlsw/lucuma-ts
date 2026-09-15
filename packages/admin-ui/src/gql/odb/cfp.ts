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
import { useEffect } from 'react';

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
  query AdminCfps($offset: CallForProposalsId) {
    # includeDeleted so DELETED (invisible) calls are fetchable — the
    # "Invisible" facet (sc-9612) needs them; visibility is filtered client-side
    # from each call's existence (WhereCallForProposals has no existence field).
    # Paged via the OFFSET cursor: a single fixed LIMIT would hide calls past it
    # — including a newly-created one, which then couldn't be selected after
    # New → Create (sc-10136). useCfps follows hasMore to the last page.
    callsForProposals(OFFSET: $offset, includeDeleted: true) {
      matches {
        ...CallForProposalsItem
      }
      hasMore
    }
  }
`);

/** The calls list — cached rows render immediately, refreshed in background.
 *  Follows the ODB's `hasMore` cursor to the last page so no call is dropped by
 *  a page limit; the returned `data` grows as pages arrive and `loading` stays
 *  true until the final page is in (mirrors useProposals / useChangeRequests). */
export function useCfps() {
  const result = useQuery(CFPS_QUERY, { variables: { offset: null }, fetchPolicy: 'cache-and-network' });
  const { data, fetchMore } = result;

  // Walk the remaining pages: each fetchMore appends the next page's matches
  // (merged via updateQuery, since the cache has no field policy for this list),
  // using the last loaded id as the cursor, until the ODB reports no more.
  useEffect(() => {
    if (!data?.callsForProposals.hasMore || fetchMore === undefined) return;
    const matches = data.callsForProposals.matches;
    const cursor = matches[matches.length - 1]?.id;
    if (cursor === undefined) return;
    void fetchMore({
      variables: { offset: cursor },
      updateQuery: (prev, { fetchMoreResult }) => ({
        callsForProposals: {
          ...fetchMoreResult.callsForProposals,
          matches: [...prev.callsForProposals.matches, ...fetchMoreResult.callsForProposals.matches],
        },
      }),
    });
  }, [data, fetchMore]);

  return {
    ...result,
    // Not settled until every page is in, so callers don't render a partial set.
    loading: result.loading || (data?.callsForProposals.hasMore ?? false),
  };
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
  const nonPartner = c.gemini?.allowsNonPartnerPi && c.gemini.nonPartnerDeadline ? [c.gemini.nonPartnerDeadline] : [];
  return [...partnerDeadlines, ...nonPartner];
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

/** Zeroed coordinate limits for a brand-new call (sc-10136). A create with all
 *  four at zero is treated as "unset" and omitted so the ODB derives them from
 *  the active period; the user can still enter real values before creating. */
const BLANK_LIMITS: SiteCoordinateLimits = { raStart: 0, raEnd: 0, decStart: 0, decEnd: 0 };

/** The observatory-specific `details` for a brand-new, unsaved call (sc-10136):
 *  empty instrument checklist and blank coordinate limits, so the ODB fills in
 *  its defaults unless the user sets them. Gemini's call type has no default,
 *  so it starts at REGULAR_SEMESTER; Subaru's defaults to NORMAL. */
function blankDetails(observatory: Observatory): CfpDetails {
  switch (observatory) {
    case 'GEMINI':
      return {
        observatory: 'GEMINI',
        type: 'REGULAR_SEMESTER',
        proprietaryMonths: 0,
        allowsNonPartnerPi: false,
        instruments: [],
        north: BLANK_LIMITS,
        south: BLANK_LIMITS,
      };
    case 'KECK':
      return { observatory: 'KECK', instruments: [], limits: BLANK_LIMITS };
    case 'SUBARU':
      return { observatory: 'SUBARU', type: 'NORMAL', instruments: [], limits: BLANK_LIMITS };
  }
}

/** A brand-new, not-yet-created call for the given observatory (sc-10136), as
 *  the editor's draft. Seeded with the current semester and its active dates
 *  (both required on create) and an otherwise-blank observatory block; the id is
 *  empty until the ODB assigns one. `createCfpInput` turns this into the create
 *  mutation input, omitting the blanks so the ODB applies its defaults. */
export function blankCall(observatory: Observatory): CallForProposals {
  const semester = currentSemester();
  const { activeStart, activeEnd } = semesterDates(semester);
  return {
    id: '',
    visible: true,
    title: '',
    semester,
    activeStart,
    activeEnd,
    active: false,
    defaultDeadline: '',
    partners: [],
    details: blankDetails(observatory),
  };
}

/** Serialize a brand-new call's draft into the create mutation input (sc-10136).
 *  Unlike `cfpPropertiesInput` (which sends every field for an edit), this omits
 *  what the user left blank — empty title, partners, instruments, and zeroed
 *  coordinate limits — so the ODB applies its defaults (all partners, all
 *  instruments, limits derived from the active period). Only the create-required
 *  fields (semester, active dates, the observatory block + its type) are always
 *  present. */
export function createCfpInput(draft: CallForProposals): CallForProposalsPropertiesInput {
  const d = draft.details;
  // Omit an empty instrument list so the ODB defaults to all; generic so each
  // observatory keeps its own instrument enum (Instrument / Keck / Subaru).
  const instruments = <T>(list: readonly T[]) => (list.length > 0 ? { instruments: [...list] } : {});
  const observatoryBlock: Pick<CallForProposalsPropertiesInput, 'gemini' | 'keck' | 'subaru'> =
    d.observatory === 'GEMINI'
      ? {
          gemini: {
            type: d.type,
            ...(d.proprietaryMonths > 0 ? { proprietaryMonths: d.proprietaryMonths } : {}),
            ...instruments(d.instruments),
            ...(isBlankLimits(d.north) && isBlankLimits(d.south)
              ? {}
              : { coordinateLimits: { north: coordinateLimitsInput(d.north), south: coordinateLimitsInput(d.south) } }),
          },
        }
      : d.observatory === 'KECK'
        ? { keck: { ...instruments(d.instruments), ...siteLimitsPatch(d.limits) } }
        : { subaru: { type: d.type, ...instruments(d.instruments), ...siteLimitsPatch(d.limits) } };
  return {
    semester: draft.semester,
    activeStart: draft.activeStart,
    activeEnd: draft.activeEnd,
    ...(draft.title.trim() === '' ? {} : { title: draft.title.trim() }),
    ...(draft.defaultDeadline.trim() === '' ? {} : { submissionDeadlineDefault: draft.defaultDeadline.trim() }),
    ...(draft.partners.length > 0
      ? {
          partners: draft.partners.map((p) => ({
            geminiPartner: p.partner,
            ...(p.deadlineOverride ? { submissionDeadlineOverride: p.deadlineOverride } : {}),
          })),
        }
      : {}),
    ...observatoryBlock,
  };
}

/** A single-site `coordinateLimits` patch (Keck/Subaru): omitted when the user
 *  left the limits blank (all-zero) so the ODB derives them. */
function siteLimitsPatch(limits: SiteCoordinateLimits) {
  return isBlankLimits(limits) ? {} : { coordinateLimits: coordinateLimitsInput(limits) };
}

/** All-zero coordinate bounds mean "unset" on a new call — the sentinel that
 *  tells createCfpInput to omit the limits so the ODB derives them. */
function isBlankLimits(l: SiteCoordinateLimits): boolean {
  return l.raStart === 0 && l.raEnd === 0 && l.decStart === 0 && l.decEnd === 0;
}

/** A call is open while today is on or before the latest of its deadlines —
 *  it stays open until every participating partner's window has closed.
 *  No deadlines at all (e.g. a draft) is treated as not yet open. */
function isCallOpen(deadlines: readonly string[]): boolean {
  if (deadlines.length === 0) return false;
  const latest = Math.max(...deadlines.map((d) => new Date(d).getTime()));
  return Date.now() <= latest;
}
