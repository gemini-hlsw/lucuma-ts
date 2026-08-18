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

/*
 * Which environment this build is. Resource currently runs against the mock
 * v1 GraphQL API (there is no real Scala backend yet), so every build is a
 * development build. When the real backend + SSO land, derive this from the
 * environment/config, like admin-ui's CURRENT_ENV.
 */
const ENV_LABEL = 'Development';

/**
 * The clock every time in the app reads in: the site's own, or UT - the two
 * clocks the observatory actually works in, so a visitor-zone option would be
 * noise. Display only: observing-night labels and evening dates are the site's
 * calendar and never move with it.
 */
const CLOCK_OPTIONS: readonly SegmentedOption<TimeDisplay>[] = [
  { label: 'Site', value: 'site', ariaLabel: 'Site local time' },
  { label: 'UTC', value: 'utc', ariaLabel: 'Coordinated Universal Time' },
];

/**
 * Top masthead: brand wordmark, the environment badge, the global selection
 * and the account control. Fixed height (`--xp-masthead-height`) at every
 * width - nothing here is conditional, so the shell below it never moves.
 *
 * ## The selection lives here, not on the pages
 *
 * Every page reads the same site, and two of them read the semester - so the
 * selection is chrome, not page content (Dan, 2026-08-10). Choosing a semester
 * whose nights do not contain the current one also moves the night to that
 * semester's first night, which is what keeps the control meaningful on the
 * night and week views: it means "take me to that semester", never a silent
 * no-op.
 *
 * The Clock control is chrome for the same reason: every clock time in the app
 * renders in the chosen zone - the site's own or UT - and the choice lives in
 * the URL (`clock=utc`), so a shared link shares its reading.
 *
 * The badge is Explore's big green DEVELOPMENT block, on purpose: a build
 * that is not production should say so louder than anything else, and saying
 * it the way the flagship app does is the point (Dan, 2026-08-10). It is the
 * one green in this bar - the accent shade, not the action green.
 *
 * The right edge mirrors Explore: the user - "Guest User" until SSO lands,
 * since the mock allows everything - and the hamburger, whose menu carries
 * About Resource (the build/version dialog) and the login that authentication
 * will enable.
 */
export default function Navbar(): JSX.Element {
  // The brand is the way home: the night in progress. Only the chrome - the
  // site and the clock choice - rides along, while the explicit night and
  // every page-scoped parameter are dropped, so the destination is always
  // tonight, not wherever a deep link was pointing.
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
  // The resolved semester, never the raw URL value: a stale link, a site
  // switch or Tonight walking past the data's edge must not blank the control
  // (domain/coverage.ts resolveSemester).
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
          // Visually hidden once the bar runs out of room (see the width budget
          // in shell.css). `sr-only` rather than `hidden`: the caption is the
          // control's only accessible name, so it has to stay in the
          // accessibility tree. An absolutely positioned child is not a flex
          // item, so its `gap` goes with it.
          labelClassName="max-[53rem]:sr-only"
        >
          {(id) => (
            <Dropdown
              inputId={id}
              // The caption is hidden below the breakpoint, so the control has
              // to say its own name to a sighted reader; a screen reader still
              // reads the label.
              title="Site"
              // Named so the browser stops warning about a form field with
              // neither id nor name: PrimeReact puts this on the hidden
              // <select> mirror it renders for form submission.
              name="site"
              value={site}
              // The observatory's own two, not whatever the data holds: the
              // control must still work when the server answers with nothing.
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
              // Says why it is empty, rather than looking broken, on a server
              // that does not serve the schedule yet.
              placeholder="None"
              // The demo flag stays on the option: synthetic records must never
              // pass for an operations record, should one ever ship again.
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
        {/* A span, not a label: SelectButton is a button group, and the group
            already announces itself through its own aria-label. */}
        <span className="flex items-center gap-1.5 text-[0.65rem] tracking-wide text-foreground-muted uppercase">
          {/* Only the word is hidden below the breakpoint - the outer span
              carries the group's layout, so the control has to stay outside
              the hidden element. */}
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
              // Explore's menu carries the login; here it waits for SSO, and a
              // disabled item says so rather than hiding the affordance.
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
