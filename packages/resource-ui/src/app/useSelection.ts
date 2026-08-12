/**
 * Reads and writes the shared view selection (site, semester, night) from the
 * URL query string, so views are linkable and navigation preserves context.
 * Every view reads the published record - there is no other document to select
 * (the schedule lifecycle was dropped from v1).
 */
import { useSearchParams } from 'react-router';

import { useNow } from '@/app/useNow';
import { observingNightOf, type TimeDisplay } from '@/domain/siteTime';
import type { Site } from '@/domain/types';

export interface Selection {
  readonly site: Site;
  /**
   * The semester the URL explicitly asks for, or null when it names none.
   *
   * Raw on purpose - the URL cannot know what the data holds. Consumers read
   * the *resolved* semester through `useSemester`, which turns a stale name,
   * an absent parameter or a site switch into a real semester instead of a
   * blank control. A hardcoded default lived here once and went stale the
   * moment the data moved past it.
   */
  readonly semester: string | null;
  readonly observingNight: string;
  /** Which clock every clock time renders in - the site's own, or UT. */
  readonly timeDisplay: TimeDisplay;
}

const asSite = (value: string | null): Site => (value === 'GS' ? 'GS' : 'GN');

export interface SelectionControls extends Selection {
  /** The night in progress at the selected site - what a URL with no night means. */
  tonight: string;
  setSite: (site: Site) => void;
  setSemester: (semester: string) => void;
  /**
   * The masthead's semester jump: the semester, and - when the caller found
   * the current night outside it - the night moved along, in one URL update.
   * That is what keeps the semester control meaningful on the night and week
   * views: choosing a semester lands inside it rather than keeping a night it
   * does not cover.
   */
  setSemesterSelection: (semester: string, observingNight: string | null) => void;
  setObservingNight: (observingNight: string) => void;
  /** Back to the night in progress: drops the explicit night from the URL. */
  clearObservingNight: () => void;
  setTimeDisplay: (display: TimeDisplay) => void;
}

/** The default night rolls over once a day at 14:00 local, so a coarse tick is plenty. */
const DEFAULT_NIGHT_TICK_MS = 5 * 60_000;

export function useSelection(): SelectionControls {
  const [params, setParams] = useSearchParams();
  const now = useNow(DEFAULT_NIGHT_TICK_MS);

  const site = asSite(params.get('site'));
  const selection: Selection = {
    site,
    semester: params.get('semester'),
    // No night in the URL means "the night in progress" - what Tonight asks
    // for, and the only sensible landing point for an operational view. A
    // fixed default date would silently open some unrelated night.
    observingNight: params.get('night') ?? observingNightOf(site, now),
    // Anything but the explicit 'utc' is the default site clock, so a
    // mistyped value degrades to the reading the site works in.
    timeDisplay: params.get('clock') === 'utc' ? 'utc' : 'site',
  };

  const update = (key: string, value: string | null, alsoDelete: readonly string[] = []): void => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === null) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        for (const stale of alsoDelete) {
          next.delete(stale);
        }
        return next;
      },
      { replace: false },
    );
  };

  return {
    ...selection,
    tonight: observingNightOf(selection.site, now),
    setSite: (site: Site) => update('site', site),
    // The month names a page of one semester's calendar (semester page,
    // ?month=...), so it cannot survive a semester change - it would identify
    // the old semester's page under the new one's URL. A site change keeps it:
    // both sites cover the same months in a semester.
    setSemester: (semester: string) => update('semester', semester, ['month']),
    setSemesterSelection: (semester: string, observingNight: string | null) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('semester', semester);
          // The month named a page of the old semester's calendar.
          next.delete('month');
          if (observingNight !== null) {
            next.set('night', observingNight);
          }
          return next;
        },
        { replace: false },
      );
    },
    setObservingNight: (night: string) => update('night', night),
    clearObservingNight: () => update('night', null),
    // The default is deleted, not written, like every other URL default here.
    setTimeDisplay: (display: TimeDisplay) => update('clock', display === 'site' ? null : 'utc'),
  };
}
