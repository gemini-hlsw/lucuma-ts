import { useSearchParams } from 'react-router';

import { useNow } from '@/app/useNow';
import { observingNightOf, type TimeDisplay } from '@/domain/siteTime';
import type { Site } from '@/domain/types';

interface Selection {
  readonly site: Site;
  /** Raw on purpose: the URL cannot know what the data holds. `useSemester` resolves it. */
  readonly semester: string | null;
  readonly observingNight: string;
  readonly timeDisplay: TimeDisplay;
}

const asSite = (value: string | null): Site => (value === 'GS' ? 'GS' : 'GN');

interface SelectionControls extends Selection {
  /** The night in progress at the selected site - what a URL with no night means. */
  tonight: string;
  setSite: (site: Site) => void;
  setSemester: (semester: string) => void;
  /** The semester, and the night moved along with it, in one URL update. */
  setSemesterSelection: (semester: string, observingNight: string | null) => void;
  setObservingNight: (observingNight: string) => void;
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
    // A fixed default date would silently open some unrelated night.
    observingNight: params.get('night') ?? observingNightOf(site, now),
    // Anything but the explicit 'utc' degrades to the reading the site works in.
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
    // The month names a page of one semester's calendar, so it cannot survive a semester change.
    setSemester: (semester: string) => update('semester', semester, ['month']),
    setSemesterSelection: (semester: string, observingNight: string | null) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('semester', semester);
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
