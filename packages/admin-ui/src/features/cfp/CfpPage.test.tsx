import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { blankCall, cfpPropertiesInput, CFPS_QUERY, CREATE_CFP_MUTATION, createCfpInput, mapCfps } from '@/gql/odb/cfp';
import type { CallForProposalsItemFragment } from '@/gql/odb/gen/graphql';
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
const existingCall = (): CallForProposalsItemFragment => ({
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

const cfpsMock = (matches: CallForProposalsItemFragment[] = [existingCall()]): MockedResponseOf<typeof CFPS_QUERY> => ({
  request: { query: CFPS_QUERY, variables: { offset: null } },
  maxUsageCount: Infinity,
  result: {
    data: {
      callsForProposals: {
        __typename: 'CallsForProposalsSelectResult',
        matches,
        hasMore: false,
      },
    },
  },
});

describe(CfpPage, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('leaves nothing selected when the selected call is deselected — sc-10137', async () => {
    const screen = await renderWithContext(<CfpPage />, { token: STAFF_TOKEN, mocks: [cfpsMock()] });

    // The first row auto-selects on load, so the editor shows its title.
    const title = screen.getByRole('textbox', { name: 'Title' });
    await expect.element(title).toHaveValue('An existing call');

    // Re-clicking the selected row deselects it; the editor must go away rather
    // than snapping back to the first row.
    await userEvent.click(screen.getByRole('cell', { name: 'An existing call' }));
    await expect.element(title).not.toBeInTheDocument();
  });

  it('never selects a call the filters hide — sc-10137', async () => {
    // The ODB lists the soft-deleted call first; the default facet hides it.
    const hidden = { ...existingCall(), id: 'c-99', title: 'A hidden call', existence: 'DELETED' as const };
    const screen = await renderWithContext(<CfpPage />, {
      token: STAFF_TOKEN,
      mocks: [cfpsMock([hidden, existingCall()])],
    });

    await expect.element(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('An existing call');
  });

  it('shows "default" in the Title and Proprietary Period of a new call, not a value nobody chose — sc-10136', async () => {
    const screen = await renderWithContext(<CfpPage />, { token: STAFF_TOKEN, mocks: [cfpsMock()] });
    await userEvent.click(screen.getByRole('button', { name: 'New' }));

    await expect.element(screen.getByRole('textbox', { name: 'Title' })).toHaveAttribute('placeholder', 'default');
    const months = screen.getByRole('spinbutton', { name: 'Proprietary Period' });
    await expect.element(months).toHaveAttribute('placeholder', 'default');
    await expect.element(months).toHaveValue('');
  });

  it('shows the real title and months of an existing call — sc-10136', async () => {
    const screen = await renderWithContext(<CfpPage />, { token: STAFF_TOKEN, mocks: [cfpsMock()] });
    await expect.element(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('An existing call');
    await expect.element(screen.getByRole('textbox', { name: 'Title' })).not.toHaveAttribute('placeholder', 'default');
    await expect.element(screen.getByRole('spinbutton', { name: 'Proprietary Period' })).toHaveValue('12');
    await expect
      .element(screen.getByRole('spinbutton', { name: 'Proprietary Period' }))
      .not.toHaveAttribute('placeholder');
  });

  it('shows a stored 0 months as 0 on an existing call, not as "default" — sc-10136', async () => {
    const zero = existingCall();
    const screen = await renderWithContext(<CfpPage />, {
      token: STAFF_TOKEN,
      mocks: [cfpsMock([{ ...zero, gemini: { ...zero.gemini!, proprietaryMonths: 0 } }])],
    });
    await expect.element(screen.getByRole('spinbutton', { name: 'Proprietary Period' })).toHaveValue('0');
  });

  /** Create a call at the end of a long list. `chooseFacetAndNew` sets up the facet and starts the draft; the
   *  create mutation for `set` answers with `created`. Returns the new call's row and the scroll spy. */
  async function createAtEndOfLongList(
    created: CallForProposalsItemFragment,
    set: ReturnType<typeof createCfpInput>,
    chooseFacetAndNew: (screen: Awaited<ReturnType<typeof renderWithContext>>) => Promise<void>,
  ) {
    // A long list: the new call joins the end of it, far below the editor the user is looking at.
    const many = Array.from({ length: 80 }, (_, i) => ({
      ...existingCall(),
      id: `c-${100 + i}`,
      title: `Call ${i + 1}`,
    }));
    let listed = many;
    const list: MockedResponseOf<typeof CFPS_QUERY> = {
      request: { query: CFPS_QUERY, variables: { offset: null } },
      maxUsageCount: Infinity,
      result: () => ({
        data: { callsForProposals: { __typename: 'CallsForProposalsSelectResult', matches: listed, hasMore: false } },
      }),
    };
    const create: MockedResponseOf<typeof CREATE_CFP_MUTATION> = {
      request: { query: CREATE_CFP_MUTATION, variables: { set } },
      result: () => {
        listed = [...many, created];
        return {
          data: {
            createCallForProposals: {
              __typename: 'CreateCallForProposalsResult',
              callForProposals: { __typename: 'CallForProposals', id: created.id },
            },
          },
        };
      },
    };
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    const screen = await renderWithContext(<CfpPage />, { token: STAFF_TOKEN, mocks: [list, create] });

    await chooseFacetAndNew(screen);
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await expect.element(screen.getByText(/Selected Call/)).toBeInTheDocument();
    return { row: screen.getByRole('row', { name: new RegExp(created.title) }), scrollIntoView, screen };
  }

  it('does not scroll when an ordinary row is selected — sc-10136', async () => {
    const two = [existingCall(), { ...existingCall(), id: 'c-101', title: 'Another call' }];
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    const screen = await renderWithContext(<CfpPage />, { token: STAFF_TOKEN, mocks: [cfpsMock(two)] });
    await userEvent.click(screen.getByRole('cell', { name: 'Another call' }));
    await expect.element(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Another call');
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('does not scroll to another row when the new call has not reached the list — sc-10136', async () => {
    // The list answer lacks the call the create returned, so the selection falls back to the first row.
    const two = [existingCall(), { ...existingCall(), id: 'c-101', title: 'Another call' }];
    const create: MockedResponseOf<typeof CREATE_CFP_MUTATION> = {
      request: { query: CREATE_CFP_MUTATION, variables: { set: createCfpInput(blankCall('GEMINI')) } },
      result: {
        data: {
          createCallForProposals: {
            __typename: 'CreateCallForProposalsResult',
            callForProposals: { __typename: 'CallForProposals', id: 'c-900' },
          },
        },
      },
    };
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    const screen = await renderWithContext(<CfpPage />, { token: STAFF_TOKEN, mocks: [cfpsMock(two), create] });

    // A different row is selected, so the fallback to the first row is a change of selection.
    await userEvent.click(screen.getByRole('cell', { name: 'Another call' }));
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await expect.element(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('An existing call');
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls only once for a created call, not each time it is selected again — sc-10136', async () => {
    const created = { ...existingCall(), id: 'c-900', title: 'A brand new call' };
    const { row, scrollIntoView, screen } = await createAtEndOfLongList(
      created,
      createCfpInput(blankCall('GEMINI')),
      async (s) => {
        await userEvent.click(s.getByRole('button', { name: 'New' }));
      },
    );
    await expect.poll(() => scrollIntoView.mock.contexts).toContain(row.element());
    // Select another row, then the created one again.
    await userEvent.click(screen.getByRole('cell', { name: 'Call 1' }));
    await expect.element(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Call 1');
    await userEvent.click(row);
    await expect.element(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('A brand new call');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('keeps the facets as they are when a call is copied, and still shows the copy — sc-10136', async () => {
    const original = existingCall();
    const copy = { ...existingCall(), id: 'c-902', title: 'An existing call (copy)' };
    let listed = [original];
    const list: MockedResponseOf<typeof CFPS_QUERY> = {
      request: { query: CFPS_QUERY, variables: { offset: null } },
      maxUsageCount: Infinity,
      result: () => ({
        data: { callsForProposals: { __typename: 'CallsForProposalsSelectResult', matches: listed, hasMore: false } },
      }),
    };
    const create: MockedResponseOf<typeof CREATE_CFP_MUTATION> = {
      request: {
        query: CREATE_CFP_MUTATION,
        variables: { set: { ...cfpPropertiesInput(mapCfps([original])[0]!), title: 'An existing call (copy)' } },
      },
      result: () => {
        listed = [original, copy];
        return {
          data: {
            createCallForProposals: {
              __typename: 'CreateCallForProposalsResult',
              callForProposals: { __typename: 'CallForProposals', id: copy.id },
            },
          },
        };
      },
    };
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    const screen = await renderWithContext(<CfpPage />, { token: STAFF_TOKEN, mocks: [list, create] });

    // Both calls have no deadline, so both count as closed: the Closed facet shows them.
    await userEvent.click(screen.container.querySelector('.cfp-facet .p-dropdown-trigger')!);
    await userEvent.click(screen.getByRole('option', { name: 'Closed' }));
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    const row = screen.getByRole('row', { name: /An existing call \(copy\)/ });
    await expect.element(row).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => scrollIntoView.mock.contexts).toContain(row.element());
    // The facet the user chose is still the one in force.
    expect(screen.container.querySelector('.cfp-facet .p-dropdown-label')?.textContent).toBe('Closed');
  });

  it('brings the newly created call into view and selects it, even when the Open facet would hide it — sc-10136', async () => {
    const { row, scrollIntoView } = await createAtEndOfLongList(
      { ...existingCall(), id: 'c-900', title: 'A brand new call' },
      createCfpInput(blankCall('GEMINI')),
      async (screen) => {
        // A new call has no deadline, so it counts as closed: the Open facet would hide it.
        await userEvent.click(screen.container.querySelector('.cfp-facet .p-dropdown-trigger')!);
        await userEvent.click(screen.getByRole('option', { name: 'Open' }));
        await userEvent.click(screen.getByRole('button', { name: 'New' }));
      },
    );
    // The new call is selected, and its row was asked to scroll into view (a test window is as tall as
    // the page, so every row is "in view" and only the request can be observed).
    await expect.element(row).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => scrollIntoView.mock.contexts).toContain(row.element());
  });

  it('brings the newly created call into view and selects it, even when the observatory facet would hide it — sc-10136', async () => {
    const keck: CallForProposalsItemFragment = {
      ...existingCall(),
      id: 'c-901',
      title: 'A brand new Keck call',
      observatory: 'KECK',
      gemini: null,
      keck: {
        __typename: 'KeckCallProperties',
        instruments: [],
        coordinateLimits: limits(),
      },
    };
    const { row, scrollIntoView } = await createAtEndOfLongList(
      keck,
      createCfpInput(blankCall('KECK')),
      async (screen) => {
        // Only Gemini calls are listed, so a Keck call would be hidden.
        await userEvent.click(screen.container.querySelectorAll('.cfp-facet .p-dropdown-trigger')[1]!);
        await userEvent.click(screen.getByRole('option', { name: 'Gemini' }));
        await userEvent.click(screen.container.querySelector('.p-splitbutton-menubutton')!);
        await userEvent.click(screen.getByRole('menuitem', { name: 'Keck call' }));
      },
    );
    // The new call is selected, and its row was asked to scroll into view (a test window is as tall as
    // the page, so every row is "in view" and only the request can be observed).
    await expect.element(row).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => scrollIntoView.mock.contexts).toContain(row.element());
  });

  describe('default partners (sc-11165)', () => {
    const partnerBox = (screen: Awaited<ReturnType<typeof renderWithContext>>, code: string, name: string) =>
      screen.getByTitle(`Include ${name} (${code}) in this call.`).getByRole('checkbox');

    const exchangeBox = (screen: Awaited<ReturnType<typeof renderWithContext>>, name: string) =>
      screen.getByTitle(`Include ${name} in this call.`).getByRole('checkbox');

    // PrimeReact keeps the Dropdown's input hidden; the visible control is its root.
    const typeDropdown = (screen: Awaited<ReturnType<typeof renderWithContext>>) =>
      screen.container.querySelector('#cfp-type')!.closest('.p-dropdown')!;

    async function startNew() {
      const screen = await renderWithContext(<CfpPage />, { token: STAFF_TOKEN, mocks: [cfpsMock()] });
      await userEvent.click(screen.getByRole('button', { name: 'New' }));
      return screen;
    }

    it('starts a new call with the Regular partners and Subaru ticked, and Keck not', async () => {
      const screen = await startNew();
      await expect.element(partnerBox(screen, 'CL', 'Chile')).toBeChecked();
      await expect.element(partnerBox(screen, 'KR', 'Korea')).toBeChecked();
      await expect.element(exchangeBox(screen, 'Subaru')).toBeChecked();
      await expect.element(exchangeBox(screen, 'Keck')).not.toBeChecked();
    });

    it('follows the type to Fast Turnaround until the partners are edited', async () => {
      const screen = await startNew();
      await userEvent.click(typeDropdown(screen));
      await userEvent.click(screen.getByRole('option', { name: 'Fast Turnaround' }));
      await expect
        .element(typeDropdown(screen).querySelector<HTMLElement>('.p-dropdown-label'))
        .toHaveTextContent('Fast Turnaround');
      await expect.element(partnerBox(screen, 'CL', 'Chile')).not.toBeChecked();
      await expect.element(partnerBox(screen, 'UH', 'University of Hawaii')).not.toBeChecked();
      await expect.element(partnerBox(screen, 'KR', 'Korea')).toBeChecked();
      await expect.element(exchangeBox(screen, 'Subaru')).toBeChecked();
    });

    it('keeps the partners the user edited when the type changes', async () => {
      const screen = await startNew();
      await userEvent.click(partnerBox(screen, 'US', 'United States'));
      await userEvent.click(typeDropdown(screen));
      await userEvent.click(screen.getByRole('option', { name: 'Fast Turnaround' }));
      await expect.element(partnerBox(screen, 'CL', 'Chile')).toBeChecked();
      await expect.element(partnerBox(screen, 'US', 'United States')).not.toBeChecked();
    });

    it('drops Subaru when an untouched call moves to a type with no defaults', async () => {
      const screen = await startNew();
      await userEvent.click(typeDropdown(screen));
      await userEvent.click(screen.getByRole('option', { name: 'Poor Weather' }));
      await expect.element(exchangeBox(screen, 'Subaru')).not.toBeChecked();
      await expect.element(partnerBox(screen, 'CL', 'Chile')).not.toBeChecked();
    });

    it('keeps an edited exchange partner when the type changes', async () => {
      const screen = await startNew();
      await userEvent.click(exchangeBox(screen, 'Subaru'));
      await userEvent.click(typeDropdown(screen));
      await userEvent.click(screen.getByRole('option', { name: 'Fast Turnaround' }));
      await expect.element(exchangeBox(screen, 'Subaru')).not.toBeChecked();
      await expect.element(partnerBox(screen, 'CL', 'Chile')).toBeChecked();
    });

    it('does not touch the partners of an existing call when its type changes, even one holding the Regular defaults', async () => {
      const regular = ['AR', 'BR', 'CA', 'CL', 'KR', 'UH', 'US'] as const;
      const call = existingCall();
      const screen = await renderWithContext(<CfpPage />, {
        token: STAFF_TOKEN,
        mocks: [
          cfpsMock([
            {
              ...call,
              gemini: {
                ...call.gemini!,
                exchangePartners: [
                  {
                    __typename: 'CallForProposalsExchangePartner' as const,
                    exchangePartner: 'SUBARU' as const,
                    submissionDeadline: null,
                    submissionDeadlineOverride: null,
                  },
                ],
              },
              partners: regular.map((geminiPartner) => ({
                __typename: 'CallForProposalsPartner' as const,
                geminiPartner,
                submissionDeadline: null,
                submissionDeadlineOverride: null,
              })),
            },
          ]),
        ],
      });
      await expect.element(partnerBox(screen, 'CL', 'Chile')).toBeChecked();
      await userEvent.click(typeDropdown(screen));
      await userEvent.click(screen.getByRole('option', { name: 'Fast Turnaround' }));
      await expect.element(partnerBox(screen, 'CL', 'Chile')).toBeChecked();
    });
  });
});
