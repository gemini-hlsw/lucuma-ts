import { dateToLocalObservingNight } from '@gemini-hlsw/lucuma-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { AdminChangeRequestsResult } from '@/gql/odb/changeRequests';
import {
  CHANGE_REQUESTS_QUERY,
  PROGRAM_OBSERVATIONS_QUERY,
  RESOLVE_KEEPING_FEEDBACK_MUTATION,
  RESOLVE_WITH_FEEDBACK_MUTATION,
} from '@/gql/odb/changeRequests';
import { CONFLICTS_QUERY, similarModeTypes } from '@/gql/odb/conflicts';
import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import ChangeRequestsPage from './ChangeRequestsPage';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

type RawRequest = AdminChangeRequestsResult['configurationRequests']['matches'][number];

const request = (): RawRequest => ({
  __typename: 'ConfigurationRequest',
  id: 'x-1',
  status: 'REQUESTED',
  justification: 'Please adjust the conditions',
  feedback: null,
  createdAt: '2027-06-01T12:30:00Z',
  applicableObservations: [],
  program: {
    __typename: 'Program',
    id: 'p-1',
    name: 'A program',
    reference: { __typename: 'ScienceProgramReference', label: 'G-2027B-0172-Q' },
    pi: null,
  },
  configuration: {
    __typename: 'Configuration',
    target: null,
    observingMode: { __typename: 'ConfigurationObservingMode', instrument: 'GMOS_SOUTH', mode: 'GMOS_SOUTH_LONG_SLIT' },
    conditions: {
      __typename: 'ConfigurationConditions',
      imageQuality: 'POINT_EIGHT',
      cloudExtinction: 'POINT_THREE',
      skyBackground: 'GRAY',
      waterVapor: 'WET',
    },
  },
});

const requests = (): MockedResponseOf<typeof CHANGE_REQUESTS_QUERY> => ({
  request: { query: CHANGE_REQUESTS_QUERY, variables: { offset: null } },
  result: {
    data: {
      configurationRequests: {
        __typename: 'ConfigurationRequestSelectResult',
        matches: [request()],
        hasMore: false,
      },
    },
  },
  maxUsageCount: Number.POSITIVE_INFINITY,
});

const observations = (): MockedResponseOf<typeof PROGRAM_OBSERVATIONS_QUERY> => ({
  request: { query: PROGRAM_OBSERVATIONS_QUERY, variables: { programId: 'p-1', offset: null } },
  result: {
    data: { observations: { __typename: 'ObservationSelectResult', matches: [], hasMore: false } },
  },
  maxUsageCount: Number.POSITIVE_INFINITY,
});

/** The Potential Conflicts table mounts with the selection. Its variables are
 *  derived exactly as the hook derives them, so the mock matches. */
const conflicts = (): MockedResponseOf<typeof CONFLICTS_QUERY> => ({
  request: {
    query: CONFLICTS_QUERY,
    variables: {
      modeTypes: [...similarModeTypes('GMOS_SOUTH_LONG_SLIT')].sort(),
      today: dateToLocalObservingNight(new Date()),
    },
  },
  result: {
    data: {
      configurationRequests: { __typename: 'ConfigurationRequestSelectResult', matches: [] },
      observations: { __typename: 'ObservationSelectResult', matches: [] },
    },
  },
  maxUsageCount: Number.POSITIVE_INFINITY,
});

/** Resolve with no response: it must go out as the document that omits
 *  `feedback` entirely, since a nulled variable erases whatever is stored.
 *  Matching this document rather than the one below is the assertion. */
const resolveKeepingFeedback = (): MockedResponseOf<typeof RESOLVE_KEEPING_FEEDBACK_MUTATION> => ({
  request: { query: RESOLVE_KEEPING_FEEDBACK_MUTATION, variables: { ids: ['x-1'], status: 'DENIED' } },
  result: {
    data: {
      updateConfigurationRequests: {
        __typename: 'UpdateConfigurationRequestsResult',
        requests: [{ __typename: 'ConfigurationRequest', id: 'x-1', status: 'DENIED', feedback: null }],
      },
    },
  },
});

/** Resolve carrying a response. The mock matches on exact variables, so it
 *  only fires for the feedback named here — that match is the assertion. */
const resolveExpecting = (feedback: string): MockedResponseOf<typeof RESOLVE_WITH_FEEDBACK_MUTATION> => ({
  request: {
    query: RESOLVE_WITH_FEEDBACK_MUTATION,
    variables: { ids: ['x-1'], status: 'DENIED', feedback },
  },
  result: {
    data: {
      updateConfigurationRequests: {
        __typename: 'UpdateConfigurationRequestsResult',
        requests: [{ __typename: 'ConfigurationRequest', id: 'x-1', status: 'DENIED', feedback }],
      },
    },
  },
});

/** Drives the review flow the way a reviewer does: pick the program, tick its
 *  one request, choose Deny. Returns the response box, seeded with boilerplate.
 *
 *  The request's checkbox is found by the label PrimeReact gives it, which
 *  names the row, rather than by position — so neither the select-all box in
 *  the header nor a column reorder can silently point this somewhere else. */
async function denyDraft(screen: Awaited<ReturnType<typeof renderWithContext>>) {
  await userEvent.click(screen.getByRole('row', { name: /G-2027B-0172-Q/ }).first());
  await userEvent.click(screen.getByLabelText('Row Selected x-1').and(screen.getByRole('checkbox')).last());
  await userEvent.click(screen.getByRole('button', { name: 'Deny', exact: true }));
  return screen.getByRole('textbox', { name: /message sent to the PI/ });
}

describe(ChangeRequestsPage, () => {
  it('resolves without writing feedback when the response is cleared', async () => {
    // "" is rejected outright by the ODB and a null variable would erase a note
    // stored earlier, so a cleared box must omit the field entirely.
    const screen = await renderWithContext(<ChangeRequestsPage />, {
      token: STAFF_TOKEN,
      mocks: [requests(), observations(), conflicts(), resolveKeepingFeedback()],
    });
    const box = await denyDraft(screen);
    await userEvent.clear(box);
    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    await expect.element(screen.getByText(/Change requests denied/)).toBeInTheDocument();
  });

  it('treats a whitespace-only response as no response', async () => {
    // "   " is as empty as "" to a reviewer, and just as invalid to the ODB.
    const screen = await renderWithContext(<ChangeRequestsPage />, {
      token: STAFF_TOKEN,
      mocks: [requests(), observations(), conflicts(), resolveKeepingFeedback()],
    });
    const box = await denyDraft(screen);
    await userEvent.fill(box, '   ');
    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    await expect.element(screen.getByText(/Change requests denied/)).toBeInTheDocument();
  });

  it('sends the reviewer’s typed response as the feedback', async () => {
    const note = 'No dark time left this semester';
    const screen = await renderWithContext(<ChangeRequestsPage />, {
      token: STAFF_TOKEN,
      mocks: [requests(), observations(), conflicts(), resolveExpecting(note)],
    });
    const box = await denyDraft(screen);
    await userEvent.fill(box, note);
    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    await expect.element(screen.getByText(/Change requests denied/)).toBeInTheDocument();
  });
});
