/**
 * In-memory store behind the mock schema.
 *
 * Read-only so far: Resource reproduces schedules that already exist, so there
 * is nothing to mutate until editing lands (descoped from v1). The store still
 * takes a seed function and is built fresh per consumer, so the dev server and
 * each browser test hold independent state once writes do arrive.
 */
import {
  type CatalogComponent,
  COMPONENT_CATALOG,
  synthesizeComponentBlocks,
  type SynthesizedComponentBlock,
} from './components.ts';
import type {
  ImportedBlock,
  ImportedClosure,
  ImportedSchedule,
  ImportedSubsystem,
  ImportedTelescopeMode,
  ImportedTooSupport,
  ImportSite,
} from './records.ts';
import { buildSeedState, type MockState } from './seed.ts';
import { type SynthesizedInstrumentBlock, synthesizeStoredInstruments } from './storedInstruments.ts';
import { addDaysIso } from './time.ts';

/**
 * A record with the semester it came from, which is the only thing the store
 * adds to what the schedules hold.
 *
 * Deliberately **no id**. These records carried a positional one until
 * 2026-08-14, when `ScheduleBlock.id` left the API: every query clips its
 * records to the window asked for, so the thing that comes back is a
 * projection and an identifier on it invites a client to cache it as an
 * entity. The published sheets carry no identifiers of their own either.
 */
export interface StoredBlock extends ImportedBlock {
  readonly semester: string;
}

export interface StoredClosure extends ImportedClosure {
  readonly semester: string;
}

export interface StoredTooSupport extends ImportedTooSupport {
  readonly semester: string;
}

export interface StoredTelescopeMode extends ImportedTelescopeMode {
  readonly semester: string;
}

export interface StoredSubsystem extends ImportedSubsystem {
  readonly semester: string;
}

/**
 * A schedule with the nights it actually covers, derived once here.
 *
 * `nights` cannot live on `ImportedSchedule` - that is the shape of the JSON on
 * disk, and this is a fact about the records inside it. Half-open like every
 * other interval this API serves: `end` is the night *after* the semester's
 * last, so the value goes straight back into `telescopeNights` and covers the
 * semester exactly. Deriving it in the constructor also makes it total -
 * `PublishedSemester.nights` is a `DateInterval!` with two non-null `Date`
 * fields, which a schedule holding no records could not answer.
 */
export interface StoredSchedule extends ImportedSchedule {
  readonly nights: { readonly start: string; readonly end: string };
}

/** Every observing night the schedule's own records name, in order. */
const observingNightsOf = (schedule: ImportedSchedule): readonly string[] =>
  [
    ...schedule.blocks.flatMap((block) => [block.firstObservingNight, block.lastObservingNight]),
    ...schedule.closures.flatMap((closure) => [closure.firstObservingNight, closure.lastObservingNight]),
  ].sort();

export class MockStore {
  readonly state: MockState;
  /** The seeded schedules, each with the nights its records cover. */
  readonly schedules: readonly StoredSchedule[];
  readonly blocks: readonly StoredBlock[];
  readonly closures: readonly StoredClosure[];
  readonly tooSupport: readonly StoredTooSupport[];
  readonly modes: readonly StoredTelescopeMode[];
  readonly subsystems: readonly StoredSubsystem[];
  /** The synthetic stored-instrument layer - see storedInstruments.ts. */
  readonly storedInstruments: readonly SynthesizedInstrumentBlock[];
  /** The synthetic ICTD layer - see components.ts for its three rules. */
  readonly components: readonly CatalogComponent[];
  readonly componentBlocks: readonly SynthesizedComponentBlock[];

  constructor(seed: () => MockState = buildSeedState) {
    this.state = seed();
    this.schedules = this.state.schedules.map((schedule) => {
      const nights = observingNightsOf(schedule);
      const first = nights[0];
      const last = nights.at(-1);
      if (first === undefined || last === undefined) {
        // Loud at construction rather than serving a `DateInterval!` with null
        // fields, which is what this did until the invariant moved here.
        throw new Error(
          `Schedule ${schedule.site} ${schedule.semester} covers no observing nights: it holds no blocks and no closures.`,
        );
      }
      return { ...schedule, nights: { start: first, end: addDaysIso(last, 1) } };
    });
    this.blocks = this.state.schedules.flatMap((schedule) =>
      schedule.blocks.map((block) => ({
        ...block,
        semester: schedule.semester,
      })),
    );
    this.closures = this.state.schedules.flatMap((schedule) =>
      schedule.closures.map((closure) => ({
        ...closure,
        semester: schedule.semester,
      })),
    );
    this.tooSupport = this.state.schedules.flatMap((schedule) =>
      (schedule.tooSupport ?? []).map((record) => ({
        ...record,
        semester: schedule.semester,
      })),
    );
    this.modes = this.state.schedules.flatMap((schedule) =>
      (schedule.modes ?? []).map((record) => ({
        ...record,
        semester: schedule.semester,
      })),
    );
    this.subsystems = this.state.schedules.flatMap((schedule) =>
      (schedule.subsystems ?? []).map((record) => ({
        ...record,
        semester: schedule.semester,
      })),
    );
    this.storedInstruments = synthesizeStoredInstruments(this.state.schedules);
    this.components = COMPONENT_CATALOG;
    this.componentBlocks = synthesizeComponentBlocks(this.state.schedules);
  }

  componentsFor(site: ImportSite): readonly CatalogComponent[] {
    return this.components.filter((component) => component.site === site);
  }

  componentBlocksFor(site: ImportSite): readonly SynthesizedComponentBlock[] {
    return this.componentBlocks.filter((block) => block.site === site);
  }

  componentById(id: string): CatalogComponent | undefined {
    return this.components.find((component) => component.id === id);
  }

  /**
   * MOUNTED blocks name an instrument; UNKNOWN blocks are runs the schedule
   * names that the instrument list does not, served as `Instrument.UNKNOWN` so
   * every recorded run is drawn rather than silently missing. ANNOTATION blocks are
   * text over unpainted cells - they mark nothing as available, so they stay
   * unserved until operations say what they mean.
   */
  mountingsFor(site: ImportSite): readonly StoredBlock[] {
    return this.blocks.filter((block) => block.site === site && block.kind !== 'ANNOTATION');
  }

  closuresFor(site: ImportSite): readonly StoredClosure[] {
    return this.closures.filter((closure) => closure.site === site);
  }

  tooSupportFor(site: ImportSite): readonly StoredTooSupport[] {
    return this.tooSupport.filter((record) => record.site === site);
  }

  modesFor(site: ImportSite): readonly StoredTelescopeMode[] {
    return this.modes.filter((record) => record.site === site);
  }

  subsystemsFor(site: ImportSite): readonly StoredSubsystem[] {
    return this.subsystems.filter((record) => record.site === site);
  }

  /**
   * The site's stored instruments - never on a port, so they never reach a
   * schedule view, and never counted towards `dataAvailable`.
   */
  storedInstrumentsFor(site: ImportSite): readonly SynthesizedInstrumentBlock[] {
    return this.storedInstruments.filter((block) => block.site === site);
  }
}
