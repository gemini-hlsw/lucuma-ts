/** The link each menu destination gets from `/semester?site=GS&semester=2026B&night=2026-09-14&view=calendar`. */
export const NAV_LINKS_FROM_GS_SEMESTER: Record<string, string> = {
  '/semester': '/semester?site=GS&night=2026-09-14',
  '/week': '/week?site=GS&night=2026-09-14',
  '/night': '/night?site=GS&night=2026-09-14',
  // The inventory answers for tonight, so a night would ride into its URL unread.
  '/instruments': '/instruments?site=GS',
  '/components': '/components?site=GS',
};
