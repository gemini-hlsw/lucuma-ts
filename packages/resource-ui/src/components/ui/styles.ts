/* Tailwind utility clusters shared across the app's own elements: a treatment used by several
   components lives here once and is imported, while DOM a library owns is styled from shell.css. */

/* The light step of the action green, not the base one: the base ring measures 2.91:1 against the
   translucent green an active nav item fills with, under the 3:1 floor for a UI part. */
export const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gpp-light';

/* Density in px, not a rem: an expander chevron is chrome and must not grow with the reader's type.
   An inline style because PrimeReact's Column takes no class that reaches the cell it sizes. */
export const EXPANDER_COLUMN_STYLE = { width: '35px' } as const;
