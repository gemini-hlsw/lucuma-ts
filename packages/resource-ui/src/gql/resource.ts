import { graphql } from './gen';

export const INSTRUMENT_LOCATION_FRAGMENT = graphql(`
  fragment InstrumentLocationItem on InstrumentLocation {
    place
    port
  }
`);

export const INSTRUMENT_AVAILABILITY_BLOCK_FRAGMENT = graphql(`
  fragment InstrumentAvailabilityBlockItem on InstrumentAvailabilityBlock {
    instrument
    publishedName
    usage
    note
    interval {
      start
      end
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
      start
      end
    }
  }
`);

export const TOO_SUPPORT_BLOCK_FRAGMENT = graphql(`
  fragment TooSupportBlockItem on TooSupportBlock {
    tooSupport
    note
    interval {
      start
      end
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
      start
      end
    }
  }
`);

export const TELESCOPE_SUBSYSTEM_AVAILABILITY_BLOCK_FRAGMENT = graphql(`
  fragment TelescopeSubsystemAvailabilityBlockItem on TelescopeSubsystemAvailabilityBlock {
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
export const INSTRUMENT_COMPONENT_AVAILABILITY_BLOCK_FRAGMENT = graphql(`
  fragment InstrumentComponentAvailabilityBlockItem on InstrumentComponentAvailabilityBlock {
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
      observingNight
      dataAvailable
      interval {
        start
        end
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
    telescopeSubsystemAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...TelescopeSubsystemAvailabilityBlockItem
    }
  }
`);

/** `telescopeNights` is asked only for `dataAvailable`; the blocks come unclipped from the ranges. */
export const WEEK_SCHEDULE_QUERY = graphql(`
  query WeekSchedule($site: Site!, $nightsStart: Date!, $nightsEnd: Date!, $start: Timestamp!, $end: Timestamp!) {
    telescopeNights(site: $site, start: $nightsStart, end: $nightsEnd) {
      observingNight
      dataAvailable
    }
    instrumentAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...InstrumentAvailabilityBlockItem
    }
    telescopeAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...TelescopeAvailabilityBlockItem
    }
    instrumentComponentAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...InstrumentComponentAvailabilityBlockItem
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
      id
      instrument
      componentType
      code
      name
      barcode
      aliases
    }
    instrumentComponentAvailability(site: $site, start: $start, end: $end, clip: false) {
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
    instrumentAvailability(site: $site, start: $start, end: $end, clip: false) {
      ...InstrumentAvailabilityBlockItem
    }
  }
`);
