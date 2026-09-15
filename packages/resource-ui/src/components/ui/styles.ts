/* Tailwind utility clusters shared across the app's own elements: a treatment used by several
   components lives here once and is imported, while DOM a library owns is styled from shell.css. */

/* The light step of the action green, not the base one: the base ring measures 2.91:1 against the
   translucent green an active nav item fills with, under the 3:1 floor for a UI part. */
export const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gpp-light';
