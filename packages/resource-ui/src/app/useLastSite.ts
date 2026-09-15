import { createPreference } from '@/app/preference';
import { type Site, SITES } from '@/domain/types';

/**
 * Readers live at one site and rarely switch, so the app opens where it was left rather than at a
 * hard-coded GN. A URL naming a site still wins: the link is the view's source of truth.
 */
export const [useLastSite, setLastSite] = createPreference<Site>('resource.site', SITES, 'GN');
