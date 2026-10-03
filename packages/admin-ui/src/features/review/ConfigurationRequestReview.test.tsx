import { dateToLocalObservingNight } from '@gemini-hlsw/lucuma-core';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { CONFLICTS_QUERY } from '@/gql/odb/conflicts';
import type { ChangeRequest } from '@/gql/types';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import { ConfigurationRequestReview } from './ConfigurationRequestReview';

function request(id: string, overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id,
    programId: 'p-1',
    programReference: 'G-2027B-0042-DD',
    programTitle: 'A proposal',
    pi: 'Grace Hopper',
    status: 'REQUESTED',
    justification: 'Please observe.',
    feedback: '',
    createdAt: '2027-06-01T12:30:00Z',
    site: 'NORTH',
    ra: '02:39:12',
    dec: '+10:50:49',
    raDeg: 39.8,
    decDeg: 10.8,
    modeType: 'GMOS_NORTH_LONG_SLIT',
    instrument: 'GMOS-N',
    conditions: 'IQ70/CC70/SB80/WV80',
    observationIds: ['o-1'],
    observations: [],
    ...overrides,
  };
}

/** The conflict check runs once a request is selected; an empty result keeps the
 *  sub-table quiet so the test can focus on the approve/deny flow. */
const emptyConflicts = (): MockedResponseOf<typeof CONFLICTS_QUERY> => ({
  request: {
    query: CONFLICTS_QUERY,
    variables: { modeTypes: ['GMOS_NORTH_LONG_SLIT'], today: dateToLocalObservingNight(new Date()) },
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      configurationRequests: { __typename: 'ConfigurationRequestSelectResult', matches: [] },
      observations: { __typename: 'ObservationSelectResult', matches: [] },
    },
  },
});

async function setup(onResolve = vi.fn().mockResolvedValue(true)) {
  const screen = await renderWithContext(
    <ConfigurationRequestReview
      requests={[request('cr-1'), request('cr-2')]}
      programLabel="G-2027B-0042-DD"
      observationsById={new Map()}
      resetKey="p-1"
      saving={false}
      onResolve={onResolve}
    />,
    { mocks: [emptyConflicts()] },
  );
  return { screen, onResolve };
}

describe(ConfigurationRequestReview, () => {
  it('shows no decision panel until a request is selected', async () => {
    const { screen } = await setup();
    await expect.element(screen.getByText('cr-1')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('approves the selected requests through onResolve and clears the selection', async () => {
    const onResolve = vi.fn().mockResolvedValue(true);
    const { screen } = await setup(onResolve);

    // Select just cr-1 via its row checkbox (accessible name set by PrimeReact),
    // not the header select-all. The role resolves to the wrapper + input; click
    // the input.
    await userEvent.click(screen.getByRole('checkbox', { name: 'Row Selected cr-1' }).last());

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await expect.poll(() => onResolve.mock.calls.length).toBe(1);
    // The seeded boilerplate goes out as the PI response.
    expect(onResolve).toHaveBeenCalledWith(['cr-1'], 'APPROVED', expect.stringContaining('have been approved'));

    // A successful resolve clears the draft, so the action panel disappears.
    await expect.element(screen.getByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('resolves without a response when the reviewer clears the box, so a stored one is kept', async () => {
    const onResolve = vi.fn().mockResolvedValue(true);
    const { screen } = await setup(onResolve);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Row Selected cr-1' }).last());
    await userEvent.click(screen.getByRole('button', { name: 'Deny' }));
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await expect.poll(() => onResolve.mock.calls.length).toBe(1);
    expect(onResolve).toHaveBeenCalledWith(['cr-1'], 'DENIED', null);
  });

  it('keeps the draft and reports the failure when the resolve is rejected', async () => {
    const onResolve = vi.fn().mockRejectedValue(new Error('ODB unavailable'));
    const { screen } = await setup(onResolve);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Row Selected cr-1' }).last());
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await expect.element(screen.getByText('Update failed')).toBeVisible();
    // The reviewer's decision and selection survive, so they can retry.
    await expect.element(screen.getByRole('button', { name: 'Confirm' })).toBeVisible();
  });

  it('drops the draft when the request set changes, so it never carries to another program', async () => {
    function Harness() {
      const [key, setKey] = useState('p-1');
      return (
        <>
          <button onClick={() => setKey('p-2')}>switch</button>
          <ConfigurationRequestReview
            requests={[request('cr-1')]}
            programLabel="G-2027B-0042-DD"
            observationsById={new Map()}
            resetKey={key}
            saving={false}
            onResolve={vi.fn().mockResolvedValue(true)}
          />
        </>
      );
    }
    const screen = await renderWithContext(<Harness />, { mocks: [emptyConflicts()] });

    await userEvent.click(screen.getByRole('checkbox', { name: 'Row Selected cr-1' }).last());
    await expect.element(screen.getByRole('button', { name: 'Approve' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'switch' }));

    await expect.element(screen.getByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('names the program by its reference in the outcome toast', async () => {
    const screen = await renderWithContext(
      <ConfigurationRequestReview
        requests={[request('cr-1')]}
        programLabel="p-1"
        programReference="G-2027B-0042-DD"
        observationsById={new Map()}
        resetKey="p-1"
        saving={false}
        onResolve={vi.fn().mockResolvedValue(true)}
      />,
      { mocks: [emptyConflicts()] },
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Row Selected cr-1' }).last());
    await userEvent.click(screen.getByRole('button', { name: 'Deny' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await expect.element(screen.getByText('1 request in G-2027B-0042-DD')).toBeVisible();
  });

  it('leaves the draft of the program now showing alone when an earlier resolve lands late', async () => {
    let finish: () => void = () => undefined;
    const slow = vi.fn().mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    function Harness() {
      const [key, setKey] = useState('p-1');
      return (
        <>
          <button onClick={() => setKey('p-2')}>switch</button>
          <ConfigurationRequestReview
            requests={[request('cr-1')]}
            programLabel="G-2027B-0042-DD"
            observationsById={new Map()}
            resetKey={key}
            saving={false}
            onResolve={slow}
          />
        </>
      );
    }
    const screen = await renderWithContext(<Harness />, { mocks: [emptyConflicts()] });

    // Start a resolve for the first program, move to the second, and start a draft there.
    await userEvent.click(screen.getByRole('checkbox', { name: 'Row Selected cr-1' }).last());
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await userEvent.click(screen.getByRole('button', { name: 'switch' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Row Selected cr-1' }).last());
    await userEvent.click(screen.getByRole('button', { name: 'Deny' }));

    finish();
    // Wait for the late resolve to land (it announces itself), so the check below
    // cannot pass merely because it ran first.
    await expect.element(screen.getByText('1 request in G-2027B-0042-DD')).toBeVisible();
    // It must not have cleared the second program's draft.
    await expect.element(screen.getByRole('button', { name: 'Confirm' })).toBeVisible();
  });

  it('leaves the draft of the program now showing alone when an earlier resolve lands late, even after returning to the first program', async () => {
    let finish: () => void = () => undefined;
    const slow = vi.fn().mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    function Harness() {
      const [key, setKey] = useState('p-1');
      return (
        <>
          <button onClick={() => setKey('p-2')}>switch</button>
          <button onClick={() => setKey('p-1')}>back</button>
          <ConfigurationRequestReview
            requests={[request('cr-1')]}
            programLabel="G-2027B-0042-DD"
            observationsById={new Map()}
            resetKey={key}
            saving={false}
            onResolve={slow}
          />
        </>
      );
    }
    const screen = await renderWithContext(<Harness />, { mocks: [emptyConflicts()] });

    // Start a resolve, go to the other program and back, and start a new draft.
    await userEvent.click(screen.getByRole('checkbox', { name: 'Row Selected cr-1' }).last());
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await userEvent.click(screen.getByRole('button', { name: 'switch' }));
    await userEvent.click(screen.getByRole('button', { name: 'back' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Row Selected cr-1' }).last());
    await userEvent.click(screen.getByRole('button', { name: 'Deny' }));

    finish();
    // Wait for the late resolve to land (it announces itself), so the check below
    // cannot pass merely because it ran first.
    await expect.element(screen.getByText('1 request in G-2027B-0042-DD')).toBeVisible();
    // It must not have cleared the second program's draft.
    await expect.element(screen.getByRole('button', { name: 'Confirm' })).toBeVisible();
  });
});
