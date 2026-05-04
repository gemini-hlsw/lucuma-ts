import type { MockLink } from '@apollo/client/testing';
import { GET_CONFIGURATION } from '@gql/configs/Configuration';
import type { InstrumentItemFragment } from '@gql/configs/gen/graphql';
import { GET_INSTRUMENT, SET_TEMPORARY_INSTRUMENT, UPDATE_INSTRUMENT } from '@gql/configs/Instrument';
import { GET_INSTRUMENT_PORT } from '@gql/server/Instrument';
import type { MockedResponseOf } from '@gql/util';
import { page, userEvent } from 'vitest/browser';

import { importInstrumentAtom } from '@/components/atoms/instrument';
import { createConfiguration, createInstrumentConfig } from '@/test/create';
import type { RenderResultWithStore } from '@/test/render';
import { renderWithContext } from '@/test/render';

import { Instrument } from './Instrument';

describe(Instrument.name, () => {
  let sut: RenderResultWithStore;
  beforeEach(async () => {
    sut = await renderWithContext(<Instrument canEdit={true} />, {
      mocks: [...mocks, getInstrumentMock, updateInstrumentMock, setTempInstrumentMock],
    });
  });

  it('should render', async () => {
    await expect.element(sut.getByText('Instrument')).toBeInTheDocument();
  });

  it('should update instrument values when typing', async () => {
    const originXInput = sut.getByLabelText('Origin X');

    await userEvent.clear(originXInput);
    await userEvent.type(originXInput, '0.2{Enter}');

    await expect.element(originXInput).not.toBeDisabled();
    await expect.element(originXInput).toHaveValue('0.20');
    await expect.element(sut.getByRole('button', { name: 'Save instrument' })).not.toBeDisabled();
    expect(setTempInstrumentMock.request.variables).toHaveBeenCalledExactlyOnceWith(
      createInstrumentConfig({
        wfs: 'OIWFS',
        originX: 0.2,
        comment: null,
        isTemporary: true,
        createdAt,
      }),
    );
  });

  it('opens the instrument modal when the import button is clicked', async () => {
    expect(sut.store.get(importInstrumentAtom)).false;
    const importInstrumentButton = sut.getByLabelText('Import instrument');

    await userEvent.click(importInstrumentButton);

    expect(sut.store.get(importInstrumentAtom)).true;
  });

  it('should call updateInstrument when save button is clicked', async () => {
    const saveButton = sut.getByRole('button', { name: 'Save instrument' });
    await userEvent.click(saveButton);
    await userEvent.fill(page.getByRole('textbox', { name: 'Enter a comment (optional)' }), 'My comment');
    await userEvent.click(page.getByRole('button', { name: 'Save', exact: true }));

    expect(updateInstrumentMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      pk: 1,
      comment: 'My comment',
      isTemporary: false,
    });
  });

  it('should query instrument using oiWfs', async () => {
    const originXInput = sut.getByLabelText('Origin X');
    await userEvent.clear(originXInput);
    await userEvent.type(originXInput, '0.2{Enter}');

    const saveButton = sut.getByRole('button', { name: 'Save instrument' });
    await expect.element(saveButton).toBeEnabled();

    expect(getInstrumentMock.request.variables).toHaveBeenCalledWith(expect.objectContaining({ wfs: 'OIWFS' }));
  });
});

const mocks: MockLink.MockedResponse[] = [
  {
    request: {
      query: GET_CONFIGURATION,
      variables: {},
    },
    result: {
      data: {
        configuration: createConfiguration({ selectedGuiderTarget: 3 }),
      },
    },
  } satisfies MockedResponseOf<typeof GET_CONFIGURATION>,
  {
    request: {
      query: GET_INSTRUMENT_PORT,
      variables: () => true,
    },
    maxUsageCount: Infinity,
    result: {
      data: {
        instrumentPort: 3,
      },
    },
  } satisfies MockedResponseOf<typeof GET_INSTRUMENT_PORT>,
];

const createdAt = new Date().toISOString();

const getInstrumentMock = {
  request: {
    query: GET_INSTRUMENT,
    variables: vi.fn().mockReturnValue(true),
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      instrument: createInstrumentConfig({
        wfs: 'OIWFS',
        originX: 0.1,
        isTemporary: true,
        comment: null,
        createdAt,
      }),
    },
  },
} satisfies MockedResponseOf<typeof GET_INSTRUMENT>;

const updateInstrumentMock = {
  request: {
    query: UPDATE_INSTRUMENT,
    variables: vi.fn().mockReturnValue(true),
  },
  maxUsageCount: Infinity,
  result: (arg) => ({
    data: {
      updateInstrument: createInstrumentConfig({
        ...getInstrumentMock.result.data.instrument,
        ...(arg as Partial<InstrumentItemFragment>),
      }),
    },
  }),
} satisfies MockedResponseOf<typeof UPDATE_INSTRUMENT>;

const setTempInstrumentMock = {
  request: {
    query: SET_TEMPORARY_INSTRUMENT,
    variables: vi.fn().mockReturnValue(true),
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      setTemporaryInstrument: createInstrumentConfig({
        originX: 0.2,
        comment: null,
        isTemporary: true,
        createdAt,
      }),
    },
  },
} satisfies MockedResponseOf<typeof SET_TEMPORARY_INSTRUMENT>;
