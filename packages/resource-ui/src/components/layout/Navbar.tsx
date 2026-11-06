import { ArrowRightFromBracket, Bars, Check, cn, Info, LayerGroup, UserIcon } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { Menu } from 'primereact/menu';
import type { MenuItem } from 'primereact/menuitem';
import { type JSX, useRef, useState } from 'react';
import { Link } from 'react-router';

import { PRODUCT_NAME } from '@/app/product';
import orcidLogo from '@/assets/orcid-logo.svg';
import { LOGIN_WITH_ORCID } from '@/auth/Splash';
import { AboutResource } from '@/components/layout/AboutResource';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl';
import { FOCUS_RING } from '@/components/ui/styles';
import type { TimeDisplay } from '@/domain/siteTime';
import { type Site, SITE_NAMES, SITES } from '@/domain/types';

const CLOCK_ITEM = 'xp-menu-clock';

const CLOCK_GROUP_LABEL = 'Clock';

const MENU_ICON = 'p-menuitem-icon';
const MENU_ID = 'xp-app-menu-list';

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

export interface NavbarProps {
  readonly homeSearch: string;
  readonly site: Site;
  readonly onSiteChange: (site: Site) => void;
  readonly timeDisplay: TimeDisplay;
  readonly onTimeDisplayChange: (timeDisplay: TimeDisplay) => void;
  readonly accountLabel: string;
  readonly isGuest: boolean;
  readonly signInHref: string;
  readonly onSignOut: () => void;
}

/** One row at every width, under the environment banner; nothing here is conditional, so the shell below never moves. */
export function Navbar({
  homeSearch,
  site,
  onSiteChange,
  timeDisplay,
  onTimeDisplayChange,
  accountLabel,
  isGuest,
  signInHref,
  onSignOut,
}: NavbarProps): JSX.Element {
  const menu = useRef<Menu>(null);
  const menuButton = useRef<Button>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const focusMenuButton = (): void => {
    if (menuButton.current instanceof HTMLButtonElement) menuButton.current.focus();
  };

  const logoutItem: MenuItem = {
    label: 'Logout',
    icon: <ArrowRightFromBracket className={MENU_ICON} aria-hidden="true" />,
    command: () => {
      focusMenuButton();
      onSignOut();
    },
  };

  const loginItem: MenuItem = {
    label: LOGIN_WITH_ORCID,
    icon: (
      <img src={orcidLogo} alt="" aria-hidden="true" className={cn(MENU_ICON, 'h-[1em] w-[1.25em] object-contain')} />
    ),
    url: signInHref,
  };

  return (
    <header className="xp-masthead">
      <Link
        to={{ pathname: '/night', search: homeSearch }}
        className={cn('xp-wordmark', FOCUS_RING)}
        title="GPP Resource - telescope calendar & operational-resource manager. Go to tonight."
      >
        {/* A glyph, not type: the wordmark beside it carries the name, and the mark matches it. */}
        <LayerGroup widthAuto className="text-gpp" aria-hidden="true" />
        {PRODUCT_NAME}
      </Link>

      <SegmentedControl
        value={site}
        options={SITE_OPTIONS}
        onChange={onSiteChange}
        ariaLabel="Site"
        testId="site-toggle"
      />

      <div className="xp-masthead-center" />

      <div className="xp-masthead-right">
        <span
          data-testid="account-control"
          className="flex items-center gap-1.5 text-xs tracking-wide text-foreground-secondary"
          title={accountLabel}
        >
          {/* A glyph, not type: the name beside it is what the row says. */}
          <UserIcon size="sm" widthAuto aria-hidden="true" />
          {/* Only the icon fits the phone bar; the name stays announced, and the menu carries it for the eye. */}
          <span className="xp-account-name max-md:sr-only">{accountLabel}</span>
        </span>
        <Button
          type="button"
          text
          size="small"
          className="xp-icon-btn"
          ref={menuButton}
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-controls={isMenuOpen ? MENU_ID : undefined}
          icon={<Bars widthAuto aria-hidden="true" />}
          onClick={(event) => {
            menu.current?.toggle(event);
          }}
        />
        <Menu
          className="xp-app-menu"
          model={[
            {
              label: 'About Resource',
              icon: <Info className={MENU_ICON} aria-hidden="true" />,
              command: () => {
                setIsAboutOpen(true);
              },
            },
            { label: CLOCK_GROUP_LABEL, className: 'xp-menu-section', items: [] },
            ...CLOCK_CHOICES.map((choice) => ({
              label: choice.label,
              className: CLOCK_ITEM,
              value: choice.value,
              icon: (
                <Check className={cn(MENU_ICON, choice.value === timeDisplay ? '' : 'invisible')} aria-hidden="true" />
              ),
              command: () => {
                onTimeDisplayChange(choice.value);
              },
            })),
            { separator: true },
            { label: accountLabel, className: 'xp-menu-account', items: [] },
            ...(isGuest ? [loginItem] : []),
            logoutItem,
          ]}
          onShow={() => {
            setIsMenuOpen(true);
          }}
          onHide={() => {
            setIsMenuOpen(false);
          }}
          pt={{
            menu: {
              id: MENU_ID,
              'aria-label': 'Application menu',
              // PrimeReact hides on Tab but lets the browser's focus move run, which walks out of the portal.
              onKeyDown: (event) => {
                if (event.key === 'Tab') {
                  event.preventDefault();
                  focusMenuButton();
                }
              },
            },
            submenuHeader: { role: 'group' },
            menuitem: (options) => {
              const item = menuItemOf(options);
              if (item?.className === CLOCK_ITEM) {
                return {
                  role: 'menuitemradio',
                  'aria-checked': item.value === timeDisplay,
                  'aria-label': `${CLOCK_GROUP_LABEL}: ${item.label ?? ''}`,
                };
              }
              return {};
            },
            action: (options) => (menuItemOf(options)?.className === CLOCK_ITEM ? { href: undefined } : {}),
          }}
          popup
          popupAlignment="right"
          ref={menu}
        />
      </div>

      <AboutResource
        visible={isAboutOpen}
        onHide={() => {
          setIsAboutOpen(false);
          focusMenuButton();
        }}
      />
    </header>
  );
}
