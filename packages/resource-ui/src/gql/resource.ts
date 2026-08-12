/**
 * Typed GraphQL operations for the Resource API.
 *
 * The block selections are fragments, so the semester, week and night queries
 * ask for the same fields and the adapters take one generated type rather than
 * one per operation.
 */
import { graphql } from './gen';

export const INSTRUMENT_BLOCK_FIELDS = graphql(`
  fragment InstrumentBlockFields on InstrumentAvailabilityBlock {
    id
    instrument
    publishedName
    rowLabel
    usage
    note
    interval {
      start
      end
    }
    location {
      type
      port
    }
  }
`);

export const CLOSURE_FIELDS = graphql(`
  fragment ClosureFields on TelescopeAvailabilityBlock {
    id
    availability
    port
    reason
    interval {
      start
      end
    }
  }
`);

export const TOO_BLOCK_FIELDS = graphql(`
  fragment TooBlockFields on TooSupportBlock {
    id
    tooSupport
    note
    interval {
      start
      end
    }
  }
`);

export const MODE_BLOCK_FIELDS = graphql(`
  fragment ModeBlockFields on TelescopeModeBlock {
    id
    mode
    programReferences
    partner
    note
    interval {
      start
      end
    }
  }
`);

/**
 * A component block as the night projection carries it: clipped to the night,
 * with the piece's full identity nested so the night view needs no second
 * round trip to the catalog.
 */
export const NIGHT_COMPONENT_FIELDS = graphql(`
  fragment NightComponentFields on InstrumentComponentAvailabilityBlock {
    id
    usage
    place
    note
    interval {
      start
      end
    }
    component {
      id
      instrument
      componentType
      code
      name
      barcode
      aliases
    }
  }
`);

export const PUBLISHED_SEMESTERS_QUERY = graphql(`
  query GetPublishedSemesters {
    publishedSemesters {
      site
      semester
      title
      version
      demo
      firstNight
      lastNight
      rowLabels
      holidays
      moonEvents {
        date
        phase
      }
    }
  }
`);

/**
 * Everything a semester view draws, in one response.
 *
 * Unclipped: a mounting that starts before the window still comes back with its
 * real interval, so the view can show that it was already there.
 */
export const SEMESTER_SCHEDULE_QUERY = graphql(`
  query GetSemesterSchedule($site: Site!, $interval: TimestampIntervalInput!) {
    instrumentAvailability(site: $site, interval: $interval, clip: false) {
      ...InstrumentBlockFields
    }
    telescopeAvailability(site: $site, interval: $interval, clip: false) {
      ...ClosureFields
    }
    tooSupport(site: $site, interval: $interval, clip: false) {
      ...TooBlockFields
    }
    telescopeMode(site: $site, interval: $interval, clip: false) {
      ...ModeBlockFields
    }
  }
`);

/**
 * One night, and the runs that reach it.
 *
 * `telescopeNight` is the projection the scheduler consumes, and it is asked for
 * here to carry the two facts a range query cannot: `dataAvailable`, which
 * separates "nothing is recorded for this night" from "nothing is available",
 * and `components` - the pieces recorded tonight, clipped to the night, which is
 * exactly the shape a mid-night change is visible in. The instrument, closure,
 * ToO and mode blocks come unclipped, so the view can say a run continues
 * beyond tonight rather than implying it ends at 14:00.
 */
export const NIGHT_SCHEDULE_QUERY = graphql(`
  query GetNightSchedule($site: Site!, $night: Date!, $interval: TimestampIntervalInput!) {
    telescopeNight(site: $site, observingNight: $night) {
      observingNight
      dataAvailable
      interval {
        start
        end
      }
      components {
        ...NightComponentFields
      }
    }
    instrumentAvailability(site: $site, interval: $interval, clip: false) {
      ...InstrumentBlockFields
    }
    telescopeAvailability(site: $site, interval: $interval, clip: false) {
      ...ClosureFields
    }
    tooSupport(site: $site, interval: $interval, clip: false) {
      ...TooBlockFields
    }
    telescopeMode(site: $site, interval: $interval, clip: false) {
      ...ModeBlockFields
    }
  }
`);

/**
 * A week of nights, and the runs that cross them.
 *
 * `telescopeNights` is the scheduler's own query, asked here only for each
 * night's `dataAvailable` - the blocks come unclipped from the range queries so
 * a run spanning the week draws as one bar rather than seven abutting ones.
 * Component records ride along for the briefing's "changes this week" list: a
 * piece failing or a mask going in is exactly the kind of thing a week is for.
 */
export const WEEK_SCHEDULE_QUERY = graphql(`
  query GetWeekSchedule($site: Site!, $nights: DateIntervalInput!, $interval: TimestampIntervalInput!) {
    telescopeNights(site: $site, nights: $nights) {
      observingNight
      dataAvailable
    }
    instrumentAvailability(site: $site, interval: $interval, clip: false) {
      ...InstrumentBlockFields
    }
    telescopeAvailability(site: $site, interval: $interval, clip: false) {
      ...ClosureFields
    }
    instrumentComponentAvailability(site: $site, interval: $interval, clip: false) {
      ...NightComponentFields
    }
    tooSupport(site: $site, interval: $interval, clip: false) {
      ...TooBlockFields
    }
    telescopeMode(site: $site, interval: $interval, clip: false) {
      ...ModeBlockFields
    }
  }
`);

/**
 * Everything the component browser needs, in one response: the catalog, every
 * piece's records over the window, and the instrument mountings the "where is
 * it" join resolves INSTALLED against.
 */
export const COMPONENT_BROWSER_QUERY = graphql(`
  query GetComponentBrowser($site: Site!, $interval: TimestampIntervalInput!) {
    components(site: $site) {
      id
      instrument
      componentType
      code
      name
      barcode
      aliases
    }
    instrumentComponentAvailability(site: $site, interval: $interval, clip: false) {
      id
      usage
      place
      note
      interval {
        start
        end
      }
      component {
        id
      }
    }
    instrumentAvailability(site: $site, interval: $interval, clip: false) {
      ...InstrumentBlockFields
    }
  }
`);
