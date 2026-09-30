import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { AdminCfpsResult } from '@/gql/odb/cfp';
import { CFPS_QUERY } from '@/gql/odb/cfp';
import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import CfpPage from './CfpPage';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

const limits = () => ({
  __typename: 'CoordinateLimits' as const,
  raStart: { __typename: 'RightAscension' as const, hours: 0 },
  raEnd: { __typename: 'RightAscension' as const, hours: 24 },
  decStart: { __typename: 'Declination' as const, degrees: -90 },
  decEnd: { __typename: 'Declination' as const, degrees: 90 },
});

/** One existing Gemini call, so the page has a selection to fall back to. */
const existingCall = (): AdminCfpsResult['callsForProposals']['matches'][number] => ({
  __typename: 'CallForProposals',
  id: 'c-100',
  existence: 'PRESENT',
  title: 'An existing call',
  semester: '2027A',
  observatory: 'GEMINI',
  active: { __typename: 'DateInterval', start: '2027-02-01', end: '2027-07-31' },
  submissionDeadlineDefault: null,
  partners: [],
  gemini: {
    __typename: 'GeminiCallProperties',
    type: 'REGULAR_SEMESTER',
    allowsNonPartnerPi: false,
    nonPartnerDeadline: null,
    proprietaryMonths: 12,
    instruments: [],
    exchangePartners: [],
    coordinateLimits: { __typename: 'SiteCoordinateLimits', north: limits(), south: limits() },
  },
  keck: null,
  subaru: null,
});

const cfpsMock = (): MockedResponseOf<typeof CFPS_QUERY> => ({
  request: { query: CFPS_QUERY, variables: { offset: null } },
  maxUsageCount: Infinity,
  result: {
    data: {
      callsForProposals: {
        __typename: 'CallsForProposalsSelectResult',
        matches: [existingCall()],
        hasMore: false,
      },
    },
  },
});

describe(CfpPage, () => {
  it('starts each New on a blank draft, discarding the one in progress (sc-10136)', async () => {
    const screen = await renderWithContext(<CfpPage />, { token: STAFF_TOKEN, mocks: [cfpsMock()] });

    // First New: type a title into the blank draft.
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    const title = screen.getByRole('textbox', { name: 'Title' });
    await expect.element(title).toHaveValue('');
    await userEvent.fill(title, 'Abandoned draft');

    // Clicking New again — the editor is still mounted, so only a changed key
    // remounts it. Keyed by observatory alone the key was identical, the editor
    // kept its state, and the abandoned draft stayed on screen.
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    await expect.element(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('');
  });
});
