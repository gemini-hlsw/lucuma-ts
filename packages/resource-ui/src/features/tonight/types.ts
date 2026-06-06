/**
 * Shared timeline models used by the timeline adapters and renderer.
 */
import type { TimestampInterval } from '@/types';

import type { GetTelescopeNightTimelineQuery } from '../../gql/gen/graphql';

export type TelescopeNightTimeline = NonNullable<GetTelescopeNightTimelineQuery['telescopeNightTimeline']>;

export type TimelineVariant =
  | 'queue'
  | 'classical'
  | 'commissioning'
  | 'engineering'
  | 'priorityVisitor'
  | 'open'
  | 'closed'
  | 'too'
  | 'unknown';

export interface TimelineBlock {
  id: string;
  interval: TimestampInterval;
  label: string;
  variant: TimelineVariant;
}

export interface TimelineRowData {
  id: string;
  label: string;
  blocks: TimelineBlock[];
}
