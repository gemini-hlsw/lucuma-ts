import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

import { setLastSite, useLastSite } from '@/app/useLastSite';
import { useNow } from '@/app/useNow';
import { observingNightOf } from '@/domain/siteTime';
import { type Site, SITES } from '@/domain/types';

interface Selection {
  readonly site: Site;
  readonly observingNight: string;
}

const asSite = (value: string | null, remembered: Site): Site => SITES.find((site) => site === value) ?? remembered;

interface SelectionControls extends Selection {
  /** The night in progress at the selected site - what a URL with no night means. */
  tonight: string;
  setSite: (site: Site) => void;
  setObservingNight: (observingNight: string) => void;
  clearObservingNight: () => void;
}

/** The default night rolls over once a day at 14:00 local, so a coarse tick is plenty. */
const DEFAULT_NIGHT_TICK_MS = 5 * 60_000;

export function useSelection(): SelectionControls {
  const [params, setParams] = useSearchParams();
  const now = useNow(DEFAULT_NIGHT_TICK_MS);
  const remembered = useLastSite();

  const named = params.get('site');
  const site = asSite(named, remembered);

  /*
   * The one URL default this app writes rather than deletes. Everywhere else an absent parameter
   * means one fixed thing, so deleting it loses nothing; an absent site means "whichever this
   * reader last used", which is not a value a link can carry. Left absent, Back off a site change
   * pops the parameter and the memory silently puts the same site back - the button appears dead -
   * and a copied URL opens at the recipient's site instead of the sender's.
   */
  useEffect(() => {
    // Also covers a site the URL names but this app does not know: the address must not claim
    // `?site=gs` while every view renders the remembered one.
    if (named !== site) {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('site', site);
          return next;
        },
        // Replace: arriving somewhere is not a step the reader took, so Back must not undo it.
        { replace: true },
      );
    }
  }, [named, site, setParams]);

  const selection: Selection = {
    site,
    // A fixed default date would silently open some unrelated night.
    observingNight: params.get('night') ?? observingNightOf(site, now),
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
    setSite: (site: Site) => {
      // Both: the URL so the view is shareable, the memory so the next visit opens here.
      setLastSite(site);
      update('site', site);
    },
    setObservingNight: (night: string) => update('night', night),
    clearObservingNight: () => update('night', null),
  };
}
