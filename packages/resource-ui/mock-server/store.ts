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

/** No id, matching `ScheduleBlock`: a stored record is a projection, not an entity to cache. */
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

/** Derived here, not on `ImportedSchedule`, and total, since `nights` is a `DateInterval!`. */
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
        // Loud at construction: a schedule covering no night can answer no range query.
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

  /** ANNOTATION blocks mark nothing as available, so they stay unserved until operations say more. */
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

  /** Never on a port, so they never reach a schedule view, and never counted towards dataAvailable. */
  storedInstrumentsFor(site: ImportSite): readonly SynthesizedInstrumentBlock[] {
    return this.storedInstruments.filter((block) => block.site === site);
  }
}
