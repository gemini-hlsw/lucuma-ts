import {
  faArrowRightFromBracket,
  faBars,
  faCheck,
  faCircleInfo,
  faLayerGroup,
  faUser,
} from '@fortawesome/pro-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn, displayName, type User } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { Menu } from 'primereact/menu';
import type { MenuItem } from 'primereact/menuitem';
import type { ToastMessage } from 'primereact/toast';
import { type JSX, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { carrySelection, searchString } from '@/app/carriedSelection';
import { setClockPreference, useClockPreference } from '@/app/useClockPreference';
import { useSelection } from '@/app/useSelection';
import orcidLogo from '@/assets/orcid-logo.svg';
import { signOut } from '@/auth/session';
import { signInUrl } from '@/auth/ssoClient';
import { type SessionStatus, useSessionStatus, useSignedOutElsewhere, useUser } from '@/components/atoms/auth';
import { useToast } from '@/components/atoms/toast';
import { AboutResource } from '@/components/layout/AboutResource';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl';
import { FOCUS_RING } from '@/components/ui/styles';
import type { TimeDisplay } from '@/domain/siteTime';
import { type Site, SITE_NAMES, SITES } from '@/domain/types';

const BRAND_LABEL = 'Resource';

const CHECKING_LABEL = 'Checking sign-in';

const SIGNED_OUT_LABEL = 'Not signed in';

const LOGGED_OUT_ANNOUNCEMENT = 'Logged out';
const LOGIN_LABEL = 'Login with ORCID';
const SESSION_ENDED_TOAST = {
  severity: 'warn',
  summary: 'Your session ended',
  detail: `Choose "${LOGIN_LABEL}" from the menu to sign in again.`,
  sticky: true,
} satisfies ToastMessage;
const SIGNED_OUT_ELSEWHERE_TOAST = {
  severity: 'info',
  summary: 'You signed out in another tab',
  sticky: true,
} satisfies ToastMessage;
const LOGOUT_UNREACHABLE_TOAST = {
  severity: 'warn',
  summary: 'Logout did not reach SSO',
  detail: 'Close the browser to end the session.',
  sticky: true,
} satisfies ToastMessage;
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
function accountLabelOf(status: SessionStatus, user: User | null): string {
  switch (status) {
    case 'checking':
      return CHECKING_LABEL;
    case 'signed-out':
      return SIGNED_OUT_LABEL;
    case 'signed-in':
      return user === null ? SIGNED_OUT_LABEL : displayName(user);
  }
}

/** One row at every width, under the environment banner; nothing here is conditional, so the shell below never moves. */
export default function Navbar(): JSX.Element {
  const [params] = useSearchParams();
  const menu = useRef<Menu>(null);
  const menuButton = useRef<Button>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [announceSignOut, setAnnounceSignOut] = useState(false);
  const signingOut = useRef(false);
  const home = searchString(carrySelection(params, ['site']));

  const { site, setSite } = useSelection();
  const timeDisplay = useClockPreference();
  const status = useSessionStatus();
  const user = useUser();
  const signedOutElsewhere = useSignedOutElsewhere();
  const toast = useToast();

  const signedIn = status === 'signed-in';
  const accountLabel = accountLabelOf(status, user);
  const announcement = !signedIn && announceSignOut ? LOGGED_OUT_ANNOUNCEMENT : '';

  const previousStatus = useRef(status);
  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = status;
    if (status === 'signed-in') {
      signingOut.current = false;
      toast?.remove(SESSION_ENDED_TOAST);
      toast?.remove(LOGOUT_UNREACHABLE_TOAST);
      toast?.remove(SIGNED_OUT_ELSEWHERE_TOAST);
    } else if (status === 'signed-out' && previous === 'signed-in' && !signingOut.current) {
      toast?.show(signedOutElsewhere ? SIGNED_OUT_ELSEWHERE_TOAST : SESSION_ENDED_TOAST);
    }
  }, [signedOutElsewhere, status, toast]);

  const focusMenuButton = (): void => {
    if (menuButton.current instanceof HTMLButtonElement) menuButton.current.focus();
  };

  const onSignOut = (): void => {
    focusMenuButton();
    setAnnounceSignOut(true);
    signingOut.current = true;
    void signOut().then(({ reachedSso }) => {
      if (!reachedSso && signingOut.current) toast?.show(LOGOUT_UNREACHABLE_TOAST);
    });
  };

  const logoutItem: MenuItem = {
    label: 'Logout',
    icon: <FontAwesomeIcon icon={faArrowRightFromBracket} className={MENU_ICON} aria-hidden="true" />,
    command: onSignOut,
  };

  const loginItem: MenuItem = {
    label: LOGIN_LABEL,
    icon: (
      <img src={orcidLogo} alt="" aria-hidden="true" className={cn(MENU_ICON, 'h-[1em] w-[1.25em] object-contain')} />
    ),
    url: signInUrl(),
  };

  return (
    <header className="xp-masthead">
      <Link
        to={{ pathname: '/night', search: home }}
        className={cn('xp-wordmark', FOCUS_RING)}
        title="GPP Resource - telescope calendar & operational-resource manager. Go to tonight."
      >
        {/* A glyph, not type: the wordmark beside it carries the name, and the mark matches it. */}
        <FontAwesomeIcon icon={faLayerGroup} widthAuto className="text-gpp" aria-hidden="true" />
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
          title={signedIn ? accountLabel : undefined}
        >
          {/* A glyph, not type: the name beside it is what the row says. */}
          <FontAwesomeIcon icon={faUser} size="sm" widthAuto aria-hidden="true" />
          {/* Only the icon fits the phone bar; the name stays announced, and the menu carries it for the eye. */}
          <span className="xp-account-name max-md:sr-only">{accountLabel}</span>
        </span>
        <span role="status" className="sr-only">
          {announcement}
        </span>
        <Button
          type="button"
          text
          size="small"
          className="xp-icon-btn"
          ref={menuButton}
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? MENU_ID : undefined}
          icon={<FontAwesomeIcon icon={faBars} widthAuto aria-hidden="true" />}
          onClick={(event) => {
            menu.current?.toggle(event);
          }}
        />
        <Menu
          className="xp-app-menu"
          model={[
            {
              label: 'About Resource',
              icon: <FontAwesomeIcon icon={faCircleInfo} className={MENU_ICON} aria-hidden="true" />,
              command: () => {
                setAboutOpen(true);
              },
            },
            { label: CLOCK_GROUP_LABEL, className: 'xp-menu-section', items: [] },
            ...CLOCK_CHOICES.map((choice) => ({
              label: choice.label,
              className: CLOCK_ITEM,
              value: choice.value,
              icon: (
                <FontAwesomeIcon
                  icon={faCheck}
                  className={cn(MENU_ICON, choice.value === timeDisplay ? '' : 'invisible')}
                  aria-hidden="true"
                />
              ),
              command: () => {
                setClockPreference(choice.value);
              },
            })),
            { separator: true },
            { label: accountLabel, className: 'xp-menu-account', items: [] },
            ...(signedIn ? [logoutItem] : []),
            ...(status === 'signed-out' ? [loginItem] : []),
          ]}
          onShow={() => {
            setMenuOpen(true);
          }}
          onHide={() => {
            setMenuOpen(false);
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
        visible={aboutOpen}
        onHide={() => {
          setAboutOpen(false);
          focusMenuButton();
        }}
      />
    </header>
  );
}
