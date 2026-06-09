/**
 * Header component for the Tonight feature.
 */
import { SelectButton, type SelectButtonChangeEvent } from 'primereact/selectbutton';
import type { JSX } from 'react';

import type { Site, TelescopeNightTimeline } from '@/types';

import type { TimelineTimeDisplay } from './time';

interface HeaderProps {
  timeline: TelescopeNightTimeline;
  timeDisplay: TimelineTimeDisplay;
  onTimeDisplayChange: (timeDisplay: TimelineTimeDisplay) => void;
}

interface SiteOption {
  readonly label: string;
  readonly value: Site;
}

interface TimeDisplayOption {
  readonly label: string;
  readonly value: TimelineTimeDisplay;
}

const siteOptions = [
  { label: 'GN', value: 'GN' },
  { label: 'GS', value: 'GS' },
] satisfies readonly SiteOption[];

const timeDisplayOptions = [
  { label: 'Site Local', value: 'site' },
  { label: 'UTC', value: 'utc' },
] satisfies readonly TimeDisplayOption[];

const isTimelineTimeDisplay = (value: unknown): value is TimelineTimeDisplay => value === 'site' || value === 'utc';

/**
 * Displays the observing night title and timeline controls.
 */
export function Header({ timeline, timeDisplay, onTimeDisplayChange }: HeaderProps): JSX.Element {
  const handleTimeDisplayChange = (event: SelectButtonChangeEvent): void => {
    if (isTimelineTimeDisplay(event.value)) {
      onTimeDisplayChange(event.value);
    }
  };

  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-semibold text-foreground">{timeline.observingNight}</h1>

      <div className="flex flex-wrap items-center gap-2">
        {/* The selected site comes from mock data until site switching is wired. */}
        <SelectButton
          value={timeline.site}
          options={siteOptions}
          allowEmpty={false}
          disabled
          pt={{
            root: {
              className: 'inline-flex overflow-hidden rounded-md border border-subtle bg-surface p-1 opacity-80',
            },
            button: (options) => ({
              className: options?.context.selected
                ? 'rounded bg-gpp/30 px-3 py-1 text-sm text-foreground'
                : 'rounded px-3 py-1 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground',
            }),
          }}
        />

        <SelectButton
          value={timeDisplay}
          options={timeDisplayOptions}
          optionLabel="label"
          optionValue="value"
          allowEmpty={false}
          onChange={handleTimeDisplayChange}
          pt={{
            root: {
              className: 'inline-flex overflow-hidden rounded-md border border-subtle bg-surface p-1',
            },
            button: (options) => ({
              className: options?.context.selected
                ? 'rounded bg-gpp/30 px-3 py-1 text-sm text-foreground'
                : 'rounded px-3 py-1 text-sm text-foreground-secondary hover:bg-surface-raised hover:text-foreground',
            }),
          }}
        />
      </div>
    </header>
  );
}
