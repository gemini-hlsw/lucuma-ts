import { faArrowRightToBracket, faBars, faCircleInfo, faLayerGroup, faUser } from '@fortawesome/pro-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { Dropdown } from 'primereact/dropdown';
import { Menu } from 'primereact/menu';
import { type JSX, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useSelection } from '@/app/useSelection';
import { useSemester } from '@/app/useSemester';
import { AboutResource } from '@/components/layout/AboutResource';
import { LabelledControl } from '@/components/ui/LabelledControl';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl';
import { FOCUS_RING } from '@/components/ui/styles';
import type { TimeDisplay } from '@/domain/siteTime';
import { type Site, SITES } from '@/domain/types';

const BRAND_LABEL = 'Resource';

/* Every build says Development: nothing distinguishes one build from another yet. */
const ENV_LABEL = 'Development';

/** Display only: observing-night labels and evening dates are the site's calendar and never move. */
const CLOCK_OPTIONS: readonly SegmentedOption<TimeDisplay>[] = [
  { label: 'Site', value: 'site', ariaLabel: 'Site local time' },
  { label: 'UTC', value: 'utc', ariaLabel: 'Coordinated Universal Time' },
];

/** Fixed height at every width, and nothing here is conditional, so the shell below never moves. */
export default function Navbar(): JSX.Element {
  // The brand is the way home: only the chrome rides along, so the destination is always tonight.
  const [params] = useSearchParams();
  const menu = useRef<Menu>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const home = new URLSearchParams();
  for (const carried of ['site', 'clock']) {
    const value = params.get(carried);
    if (value !== null) {
      home.set(carried, value);
    }
  }

  const { site, observingNight, timeDisplay, setSite, setSemesterSelection, setTimeDisplay } = useSelection();
  // The resolved semester, never the raw URL value: a stale link must not blank the control.
  const { semester, semestersForSite } = useSemester();

  const chooseSemester = (value: string): void => {
    const chosen = semestersForSite.find((entry) => entry.semester === value);
    const outside = chosen !== undefined && (observingNight < chosen.firstNight || observingNight > chosen.lastNight);
    setSemesterSelection(value, outside ? chosen.firstNight : null);
  };

  return (
    <header className="xp-masthead">
      <Link
        to={{ pathname: '/night', search: home.toString() === '' ? '' : `?${home.toString()}` }}
        className={cn('xp-wordmark', FOCUS_RING)}
        title="GPP Resource - telescope calendar & operational-resource manager. Go to tonight."
      >
        <FontAwesomeIcon icon={faLayerGroup} className="text-sm text-gpp" aria-hidden="true" />
        {BRAND_LABEL}
      </Link>

      <div className="xp-masthead-center">
        <span
          className="xp-env-marker"
          data-testid="env-marker"
          title="Development build. Data comes from the Resource service, which does not serve this API yet. No authentication yet."
        >
          {ENV_LABEL}
        </span>
      </div>

      <div className="xp-masthead-right">
        <LabelledControl
          label="Site"
          className="flex items-center gap-1.5 text-[0.65rem] tracking-wide text-foreground-muted uppercase"
          // sr-only rather than hidden: the caption is the control's only accessible name.
          labelClassName="max-[53rem]:sr-only"
        >
          {(id) => (
            <Dropdown
              inputId={id}
              // The caption is hidden below the breakpoint, so the control says its own name.
              title="Site"
              // Named so the browser stops warning about PrimeReact's hidden <select> mirror.
              name="site"
              value={site}
              // The observatory's own two: the control must work when the server answers nothing.
              options={SITES.map((value) => ({ label: value, value }))}
              onChange={(event) => {
                setSite(event.value as Site);
              }}
              className="xp-masthead-select w-20"
            />
          )}
        </LabelledControl>
        <LabelledControl
          label="Semester"
          className="flex items-center gap-1.5 text-[0.65rem] tracking-wide text-foreground-muted uppercase"
          labelClassName="max-[53rem]:sr-only"
        >
          {(id) => (
            <Dropdown
              inputId={id}
              title="Semester"
              name="semester"
              value={semester?.semester ?? null}
              // Says why it is empty rather than looking broken.
              placeholder="None"
              // The demo flag stays on the option: synthetic records must never pass for real ones.
              options={semestersForSite.map((entry) => ({
                label: entry.demo ? `${entry.semester} (demo)` : entry.semester,
                value: entry.semester,
              }))}
              onChange={(event) => {
                chooseSemester(event.value as string);
              }}
              className="xp-masthead-select w-32"
            />
          )}
        </LabelledControl>
        {/* A span, not a label: the SelectButton group already announces itself. */}
        <span className="flex items-center gap-1.5 text-[0.65rem] tracking-wide text-foreground-muted uppercase">
          {/* Only the word hides below the breakpoint: the outer span carries the group's layout. */}
          <span className="max-[53rem]:sr-only">Clock</span>
          <SegmentedControl
            size="sm"
            value={timeDisplay}
            options={CLOCK_OPTIONS}
            onChange={setTimeDisplay}
            ariaLabel="Clock"
            testId="clock-toggle"
          />
        </span>

        <span
          data-testid="account-control"
          className="flex items-center gap-1.5 text-xs tracking-wide text-foreground-secondary"
          title="Authentication is not implemented yet - the mock allows everything."
        >
          <FontAwesomeIcon icon={faUser} className="text-[0.7rem]" aria-hidden="true" />
          Guest User
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
