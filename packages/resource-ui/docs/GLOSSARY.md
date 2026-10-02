# Resource

Resource reads the published telescope schedule: which instruments and components each Gemini site has, where they
are, and when.

## Language

**Inventory**:
Everything a site has ever recorded, of one kind (instruments or components), with the state of each one right now.
Always the present; a past date is read on one item's history, not on the inventory.
_Avoid_: Finder, browser

**Current state**:
Where an item is and whether it is usable at this instant, as the published record says. Not tonight's state: a
change later tonight is the item's next change.
_Avoid_: Tonight, status

**Block**:
One recorded fact about one subject (the telescope, an instrument, a subsystem or a component) over a half-open
interval: the start is included, the end is not. A block has no identity of its own; a query can trim it to a window.
_Avoid_: Mounting, closure, record, entry

**Gap**:
A stretch of time with no block for a subject. It means "not recorded", never "closed" or "unavailable".
_Avoid_: Closed, empty, downtime

**Observing night**:
The night labelled by a date, running from 14:00 site-local time on the previous day to 14:00 site-local time on that
date.
_Avoid_: Night of (date), calendar day
