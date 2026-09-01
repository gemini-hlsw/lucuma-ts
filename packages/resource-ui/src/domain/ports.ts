import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';

/** A fact about the support structure, not a schedule: a blank row is "nothing recorded" (I4). */
export const TELESCOPE_PORTS: readonly number[] = [1, 2, 3, 4, 5];

/** How a port row is labelled, everywhere one is printed. */
export const portRowLabel = (port: number): string => `Port ${String(port)}`;

/** The union keeps a record off no chart: a sixth port would draw rather than vanish. */
export const portRows = (recorded: Iterable<number | null>): readonly number[] =>
  [...new Set([...TELESCOPE_PORTS, ...[...recorded].filter(isNotNullish)])].sort((a, b) => a - b);
