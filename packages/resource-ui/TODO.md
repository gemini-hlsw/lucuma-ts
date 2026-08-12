# Resource UI - open items

What remains after the 2026-08-10 walkthrough punch list was worked off. The ten
items it opened with - five v1 blockers, five worth-doing - all landed the same
day and are recorded in the git history; this file keeps only what is still
open.

## Later / optional

- A visible **"List" as a fourth view toggle** - the block table already exists
  as the accessible reading; exposing it is nearly free but adds a mode.
- **Retry affordance** on the load-error banner (message-only today).
- **Components table sort state in the URL** - the last non-linkable state.
- **"Jump to current month"** in the calendar when the viewed semester contains
  today.

## Checked, deliberately unchanged

- Empty calendar squares stay empty: the not-recorded vs closed distinction is
  load-bearing (I4); do not decorate gaps.
- Density (13px root) and scaling - matched against Explore at both widths.
