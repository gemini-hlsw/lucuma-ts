/**
 * In-memory store behind the mock schema.
 *
 * Read-only so far: Resource reproduces schedules that already exist, so there
 * is nothing to mutate until editing lands (PLAN.md Phase 4). The store still
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
  ImportedTelescopeMode,
  ImportedTooSupport,
  ImportSite,
} from './import/blocks.ts';
import { buildSeedState, type MockState } from './seed.ts';

/** A block with the stable id the API exposes it under. */
export interface StoredBlock extends ImportedBlock {
  readonly id: string;
  readonly semester: string;
}

/** A closure with the stable id the API exposes it under. */
export interface StoredClosure extends ImportedClosure {
  readonly id: string;
  readonly semester: string;
}

/** A ToO support record with the stable id the API exposes it under. */
export interface StoredTooSupport extends ImportedTooSupport {
  readonly id: string;
  readonly semester: string;
}

/** A telescope mode record with the stable id the API exposes it under. */
export interface StoredTelescopeMode extends ImportedTelescopeMode {
  readonly id: string;
  readonly semester: string;
}

/**
 * Ids are positional within a schedule.
 *
 * The published sheets carry no identifiers of their own, and a re-import of the
 * same sheet produces the same order, so this is stable across runs without
 * inventing a persistent identity the source does not have.
 */
const idOf = (schedule: ImportedSchedule, kind: string, index: number): string =>
  `${schedule.site}-${schedule.semester}-${kind}-${String(index)}`;

export class MockStore {
  readonly state: MockState;
  readonly blocks: readonly StoredBlock[];
  readonly closures: readonly StoredClosure[];
  readonly tooSupport: readonly StoredTooSupport[];
  readonly modes: readonly StoredTelescopeMode[];
  /** The synthetic ICTD layer - see components.ts for its three rules. */
  readonly components: readonly CatalogComponent[];
  readonly componentBlocks: readonly SynthesizedComponentBlock[];

  constructor(seed: () => MockState = buildSeedState) {
    this.state = seed();
    this.blocks = this.state.schedules.flatMap((schedule) =>
      schedule.blocks.map((block, index) => ({
        ...block,
        id: idOf(schedule, 'b', index),
        semester: schedule.semester,
      })),
    );
    this.closures = this.state.schedules.flatMap((schedule) =>
      schedule.closures.map((closure, index) => ({
        ...closure,
        id: idOf(schedule, 'c', index),
        semester: schedule.semester,
      })),
    );
    this.tooSupport = this.state.schedules.flatMap((schedule) =>
      (schedule.tooSupport ?? []).map((record, index) => ({
        ...record,
        id: idOf(schedule, 't', index),
        semester: schedule.semester,
      })),
    );
    this.modes = this.state.schedules.flatMap((schedule) =>
      (schedule.modes ?? []).map((record, index) => ({
        ...record,
        id: idOf(schedule, 'm', index),
        semester: schedule.semester,
      })),
    );
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

  schedulesFor(site: ImportSite): readonly ImportedSchedule[] {
    return this.state.schedules.filter((schedule) => schedule.site === site);
  }

  /**
   * MOUNTED blocks name an instrument; UNKNOWN blocks are the sheet's unkeyed
   * colours (PLAN.md §7), served as `Instrument.UNKNOWN` so every cell the
   * sheet paints is drawn rather than silently missing. ANNOTATION blocks are
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
}
