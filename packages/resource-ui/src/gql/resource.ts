import { graphql } from './gen';

export const TIMESTAMP_INTERVAL_FRAGMENT = graphql(`
  fragment TimestampIntervalItem on TimestampInterval {
    start
    end
  }
`);

export const DATE_INTERVAL_FRAGMENT = graphql(`
  fragment DateIntervalItem on DateInterval {
    start
    end
  }
`);

export const INSTRUMENT_LOCATION_FRAGMENT = graphql(`
  fragment InstrumentLocationItem on InstrumentLocation {
    place
    port
  }
`);

export const INSTRUMENT_COMPONENT_REF_FRAGMENT = graphql(`
  fragment InstrumentComponentRef on InstrumentComponent {
    id
  }
`);

export const INSTRUMENT_COMPONENT_FRAGMENT = graphql(`
  fragment InstrumentComponentItem on InstrumentComponent {
    id
    instrument
    componentType
    code
    name
    barcode
    aliases
  }
`);

export const INSTRUMENT_COMPONENT_AVAILABILITY_BLOCK_FRAGMENT = graphql(`
  fragment InstrumentComponentAvailabilityBlockItem on InstrumentComponentAvailabilityBlock {
    usage
    location
    note
    interval {
      ...TimestampIntervalItem
    }
    component {
      ...InstrumentComponentRef
    }
  }
`);

export const PUBLISHED_SEMESTER_FRAGMENT = graphql(`
  fragment PublishedSemesterItem on PublishedSemester {
    site
    semester
    nights {
      ...DateIntervalItem
    }
  }
`);

export const INSTRUMENT_AVAILABILITY_BLOCK_FRAGMENT = graphql(`
  fragment InstrumentAvailabilityBlockItem on InstrumentAvailabilityBlock {
    instrument
    publishedName
    usage
    note
    interval {
      ...TimestampIntervalItem
    }
    location {
      ...InstrumentLocationItem
    }
  }
`);

export const TELESCOPE_AVAILABILITY_BLOCK_FRAGMENT = graphql(`
  fragment TelescopeAvailabilityBlockItem on TelescopeAvailabilityBlock {
    availability
    port
    reason
    interval {
      ...TimestampIntervalItem
    }
  }
`);

export const TOO_SUPPORT_BLOCK_FRAGMENT = graphql(`
  fragment TooSupportBlockItem on TooSupportBlock {
    tooSupport
    note
    interval {
      ...TimestampIntervalItem
    }
  }
`);

export const TELESCOPE_MODE_BLOCK_FRAGMENT = graphql(`
  fragment TelescopeModeBlockItem on TelescopeModeBlock {
    mode
    programReferences
    partner
    note
    interval {
      ...TimestampIntervalItem
    }
  }
`);

export const TELESCOPE_NIGHT_FRAGMENT = graphql(`
  fragment TelescopeNightItem on TelescopeNight {
    observingNight
    dataAvailable
  }
`);

export const PUBLISHED_SEMESTERS_QUERY = graphql(`
  query PublishedSemesters {
    publishedSemesters {
      ...PublishedSemesterItem
    }
  }
`);

/** Unclipped, so the view can show an instrument block was already there before the window. */
export const SEMESTER_SCHEDULE_QUERY = graphql(`
  query SemesterSchedule($site: Site!, $start: Timestamp!, $end: Timestamp!) {
    instrumentAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...InstrumentAvailabilityBlockItem
    }
    telescopeAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...TelescopeAvailabilityBlockItem
    }
    tooSupport(site: $site, start: $start, end: $end, clip: false) {
      ...TooSupportBlockItem
    }
    telescopeMode(site: $site, start: $start, end: $end, clip: false) {
      ...TelescopeModeBlockItem
    }
  }
`);

/** `telescopeNight` carries `dataAvailable`, which no range query can; `components` is unselected. */
export const NIGHT_SCHEDULE_QUERY = graphql(`
  query NightSchedule($site: Site!, $night: Date!, $start: Timestamp!, $end: Timestamp!) {
    telescopeNight(site: $site, observingNight: $night) {
      ...TelescopeNightItem
      interval {
        ...TimestampIntervalItem
      }
    }
    instrumentAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...InstrumentAvailabilityBlockItem
    }
    telescopeAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...TelescopeAvailabilityBlockItem
    }
    tooSupport(site: $site, start: $start, end: $end, clip: false) {
      ...TooSupportBlockItem
    }
    telescopeMode(site: $site, start: $start, end: $end, clip: false) {
      ...TelescopeModeBlockItem
    }
  }
`);

/** `telescopeNights` is asked only for `dataAvailable`; the blocks come unclipped from the ranges. */
export const WEEK_SCHEDULE_QUERY = graphql(`
  query WeekSchedule($site: Site!, $nightsStart: Date!, $nightsEnd: Date!, $start: Timestamp!, $end: Timestamp!) {
    telescopeNights(site: $site, start: $nightsStart, end: $nightsEnd) {
      ...TelescopeNightItem
    }
    instrumentAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...InstrumentAvailabilityBlockItem
    }
    telescopeAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...TelescopeAvailabilityBlockItem
    }
    tooSupport(site: $site, start: $start, end: $end, clip: false) {
      ...TooSupportBlockItem
    }
    telescopeMode(site: $site, start: $start, end: $end, clip: false) {
      ...TelescopeModeBlockItem
    }
  }
`);

/** The catalog, every piece's records, and the instrument blocks the INSTALLED join resolves against. */
export const COMPONENT_BROWSER_QUERY = graphql(`
  query ComponentBrowser($site: Site!, $start: Timestamp!, $end: Timestamp!) {
    components(site: $site) {
      ...InstrumentComponentItem
    }
    instrumentComponentAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...InstrumentComponentAvailabilityBlockItem
    }
    instrumentAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...InstrumentAvailabilityBlockItem
    }
  }
`);
