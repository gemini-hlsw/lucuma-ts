import { graphql } from './gen';

export const INSTRUMENT_BLOCK_FIELDS = graphql(`
  fragment InstrumentBlockFields on InstrumentAvailabilityBlock {
    instrument
    publishedName
    usage
    note
    interval {
      start
      end
    }
    location {
      place
      port
    }
  }
`);

export const CLOSURE_FIELDS = graphql(`
  fragment ClosureFields on TelescopeAvailabilityBlock {
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

export const SUBSYSTEM_BLOCK_FIELDS = graphql(`
  fragment SubsystemBlockFields on TelescopeSubsystemAvailabilityBlock {
    subsystem
    usage
    powerSource
    note
    interval {
      start
      end
    }
  }
`);

/** The piece's identity is nested, so a view listing what changed needs no second round trip. */
export const NIGHT_COMPONENT_FIELDS = graphql(`
  fragment NightComponentFields on InstrumentComponentAvailabilityBlock {
    usage
    location
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
  query PublishedSemesters {
    publishedSemesters {
      site
      semester
      title
      version
      demo
      nights {
        start
        end
      }
      holidays
      moonEvents {
        date
        phase
      }
    }
  }
`);

/** Unclipped, so the view can show a mounting was already there before the window. */
export const SEMESTER_SCHEDULE_QUERY = graphql(`
  query SemesterSchedule($site: Site!, $interval: TimestampIntervalInput!) {
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

/** `telescopeNight` carries `dataAvailable`, which no range query can; `components` is unselected. */
export const NIGHT_SCHEDULE_QUERY = graphql(`
  query NightSchedule($site: Site!, $night: Date!, $interval: TimestampIntervalInput!) {
    telescopeNight(site: $site, observingNight: $night) {
      observingNight
      dataAvailable
      interval {
        start
        end
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
    telescopeSubsystemAvailability(site: $site, interval: $interval, clip: false) {
      ...SubsystemBlockFields
    }
  }
`);

/** `telescopeNights` is asked only for `dataAvailable`; the blocks come unclipped from the ranges. */
export const WEEK_SCHEDULE_QUERY = graphql(`
  query WeekSchedule($site: Site!, $nights: DateIntervalInput!, $interval: TimestampIntervalInput!) {
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

/** The catalog, every piece's records, and the mountings the INSTALLED join resolves against. */
export const COMPONENT_BROWSER_QUERY = graphql(`
  query ComponentBrowser($site: Site!, $interval: TimestampIntervalInput!) {
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
      usage
      location
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
