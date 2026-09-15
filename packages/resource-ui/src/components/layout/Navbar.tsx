import {
  faArrowRightToBracket,
  faBars,
  faCheck,
  faCircleInfo,
  faLayerGroup,
  faUser,
} from '@fortawesome/pro-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { Menu } from 'primereact/menu';
import { type JSX, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { carrySelection, searchString } from '@/app/carriedSelection';
import { setClockPreference, useClockPreference } from '@/app/useClockPreference';
import { useSelection } from '@/app/useSelection';
import { AboutResource } from '@/components/layout/AboutResource';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl';
import { FOCUS_RING } from '@/components/ui/styles';
import type { TimeDisplay } from '@/domain/siteTime';
import { type Site, SITE_NAMES, SITES } from '@/domain/types';

const BRAND_LABEL = 'Resource';

const ACCOUNT_LABEL = 'Guest User';

/** Marks the two rows that are one choice rather than two commands; also their PassThrough key. */
const CLOCK_ITEM = 'xp-menu-clock';

const CLOCK_GROUP_LABEL = 'Clock';

interface ClockMenuItem {
  readonly className?: string;
  readonly value?: TimeDisplay;
  readonly label?: string;
}

const menuItemOf = (options: unknown): ClockMenuItem | undefined =>
  (options as { context?: { item?: ClockMenuItem } }).context?.item;

/** Site is identity, not a filter: the bar reads "Resource at GN", so the codes sit by the wordmark. */
const SITE_OPTIONS: readonly SegmentedOption<Site>[] = SITES.map((value) => ({
  label: value,
  value,
  ariaLabel: SITE_NAMES[value],
}));

/** Display only: observing-night labels and evening dates are the site's calendar and never move. */
const CLOCK_CHOICES: readonly { readonly label: string; readonly value: TimeDisplay }[] = [
  { label: 'Site time', value: 'site' },
  { label: 'UTC', value: 'utc' },
];

/** One row at every width, under the environment banner; nothing here is conditional, so the shell below never moves. */
export default function Navbar(): JSX.Element {
  const [params] = useSearchParams();
  const menu = useRef<Menu>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  // No `night`: the brand is the way home, and home is tonight.
  const home = searchString(carrySelection(params, ['site']));

  const { site, setSite } = useSelection();
  const timeDisplay = useClockPreference();

  return (
    <header className="xp-masthead">
      <Link
        to={{ pathname: '/night', search: home }}
        className={cn('xp-wordmark', FOCUS_RING)}
        title="GPP Resource - telescope calendar & operational-resource manager. Go to tonight."
      >
        <FontAwesomeIcon icon={faLayerGroup} className="text-sm text-gpp" aria-hidden="true" />
        {BRAND_LABEL}
      </Link>

      <SegmentedControl
        size="sm"
        value={site}
        options={SITE_OPTIONS}
        onChange={setSite}
        ariaLabel="Site"
        testId="site-toggle"
      />

      <div className="xp-masthead-center" />

      <div className="xp-masthead-right">
        <span
          data-testid="account-control"
          className="flex items-center gap-1.5 text-xs tracking-wide text-foreground-secondary"
          title="Authentication is not implemented yet - the mock allows everything."
        >
          <FontAwesomeIcon icon={faUser} className="text-[0.7rem]" aria-hidden="true" />
          {/* Only the icon fits the phone bar; the name stays announced, and the menu carries it for the eye. */}
          <span className="max-md:sr-only">{ACCOUNT_LABEL}</span>
        </span>
        <button
          type="button"
          className={cn('xp-icon-btn', FOCUS_RING)}
          aria-label="Menu"
          aria-haspopup="menu"
          onClick={(event) => {
            menu.current?.toggle(event);
          }}
        >
          <FontAwesomeIcon icon={faBars} aria-hidden="true" />
        </button>
        <Menu
          model={[
            // An empty submenu is this Menu's only non-interactive header.
            { label: ACCOUNT_LABEL, className: 'xp-menu-account', items: [] },
            { label: CLOCK_GROUP_LABEL, className: 'xp-menu-section', items: [] },
            ...CLOCK_CHOICES.map((choice) => ({
              label: choice.label,
              className: CLOCK_ITEM,
              value: choice.value,
              icon: (
                <FontAwesomeIcon
                  icon={faCheck}
                  className={cn('mr-2 text-[0.8rem]', choice.value === timeDisplay ? '' : 'invisible')}
                  aria-hidden="true"
                />
              ),
              command: () => {
                setClockPreference(choice.value);
              },
            })),
            { separator: true },
            {
              label: 'About Resource',
              icon: <FontAwesomeIcon icon={faCircleInfo} className="mr-2 text-[0.8rem]" aria-hidden="true" />,
              command: () => {
                setAboutOpen(true);
              },
            },
            { separator: true },
            {
              label: 'Login with ORCID',
              icon: <FontAwesomeIcon icon={faArrowRightToBracket} className="mr-2 text-[0.8rem]" aria-hidden="true" />,
              // A disabled item says the login waits for SSO rather than hiding the affordance.
              disabled: true,
            },
          ]}
          pt={{
            // `role="none"` strips a header's words from the accessibility tree; `group` keeps them.
            // Traversal is unaffected: the key handler collects `li[data-pc-section="menuitem"]`,
            // which a header is not.
            submenuHeader: { role: 'group' },
            menuitem: (options) => {
              const item = menuItemOf(options);
              return item?.className === CLOCK_ITEM
                ? {
                    role: 'menuitemradio',
                    'aria-checked': item.value === timeDisplay,
                    // The heading above says what the pair is for; a flat menu announces each row
                    // on its own, so each row says it too. The visible label stays the short one.
                    'aria-label': `${CLOCK_GROUP_LABEL}: ${item.label ?? ''}`,
                  }
                : {};
            },
            // One control per row: an anchor inside the row is a second interactive element with
            // nothing of its own to do, and the click handlers sit on the row either way.
            action: (options) => (menuItemOf(options)?.className === CLOCK_ITEM ? { href: undefined } : {}),
          }}
          popup
          popupAlignment="right"
          ref={menu}
          aria-label="Application menu"
        />
      </div>

      <AboutResource
        visible={aboutOpen}
        onHide={() => {
          setAboutOpen(false);
        }}
      />
    </header>
  );
}
