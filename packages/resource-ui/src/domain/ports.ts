/**
 * The telescope's instrument ports - the subject rows every schedule view draws.
 *
 * A record says where it is (`location`), and for a mounting that is a port
 * number; the row it belongs to and the label that row prints are both
 * renderings of that number. Nothing carries a row label, and nothing parses one
 * back into a port.
 */
import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';

/**
 * The five instrument ports each telescope has.
 *
 * A fact about the instrument support structure, not about a published
 * schedule, which is why it is a constant here rather than a field on a
 * semester: the ports exist whether or not a given semester puts anything on
 * them, and a port with nothing recorded must still draw its row - a blank row
 * is "nothing recorded" (I4), while a missing row would tell the reader the
 * port does not exist.
 *
 * (The workbook prints "Port 1-up"; the suffix names the port's fixed
 * orientation, not schedule data.)
 */
export const TELESCOPE_PORTS: readonly number[] = [1, 2, 3, 4, 5];

/** How a port row is labelled, everywhere one is printed. */
export const portRowLabel = (port: number): string => `Port ${String(port)}`;

/**
 * The port rows to draw, given the ports the records actually name.
 *
 * The telescope's own ports, plus any other port a record claims. The union is
 * what keeps a record off no chart: if operations ever record a sixth port, it
 * draws rather than silently vanishing between the rows.
 */
export const portRows = (recorded: Iterable<number | null>): readonly number[] =>
  [...new Set([...TELESCOPE_PORTS, ...[...recorded].filter(isNotNullish)])].sort((a, b) => a - b);
