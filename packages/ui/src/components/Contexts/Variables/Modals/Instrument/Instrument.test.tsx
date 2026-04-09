import { GET_CONFIGURATION, UPDATE_CONFIGURATION } from '@gql/configs/Configuration';
import type { Configuration, InstrumentConfig } from '@gql/configs/gen/graphql';
import {
  GET_DISTINCT_INSTRUMENTS,
  GET_DISTINCT_PORTS,
  GET_INSTRUMENT,
  GET_INSTRUMENTS,
  SET_TEMPORARY_INSTRUMENT,
} from '@gql/configs/Instrument';
import { GET_INSTRUMENT_PORT } from '@gql/server/Instrument';
import type { MockedResponseOf } from '@gql/util';
import { page, userEvent } from 'vitest/browser';

import { importInstrumentAtom } from '@/components/atoms/instrument';
import { createConfiguration, createInstrumentConfig } from '@/test/create';
import { selectDropdownOption } from '@/test/helpers';
import { renderWithContext } from '@/test/render';

import { Instrument } from './Instrument';

describe(`${Instrument.name} modal`, () => {
  const mocks = [
    getConfigurationMock,
    getInstrumentPortMock,
    getInstrumentMock,
    distinctInstrumentsMock,
    distinctPortsMock,
    getInstrumentsMock,
    setTemporaryInstrumentMock,
    updateConfigurationMock,
  ];

  it('should hide with importInstrument false', async () => {
    await renderWithContext(<Instrument />, { mocks, initialValues: [[importInstrumentAtom, false]] });
    const dialog = page.getByRole('dialog');

    await expect.element(dialog).not.toBeInTheDocument();
  });

  it('should show with importInstrument true', async () => {
    await renderWithContext(<Instrument />, { mocks, initialValues: [[importInstrumentAtom, true]] });
    const dialog = page.getByRole('dialog');

    await expect.element(dialog.getByText('Import instrument')).toBeVisible();
    await expect.element(dialog.getByLabelText('Instrument', { exact: true })).toBeEnabled();
    await expect.element(dialog.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('should show instruments after selecting name and port', async () => {
    const sut = await renderWithContext(<Instrument />, { mocks, initialValues: [[importInstrumentAtom, true]] });
    const dialog = page.getByRole('dialog');

    // Select instrument options
    await selectDropdownOption(sut, 'Select instrument', 'GMOS_NORTH');
    await selectDropdownOption(sut, 'Select port', '3');
    expect(getInstrumentsMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      name: 'GMOS_NORTH',
      issPort: 3,
    });

    // Select first row of instrument table and import it
    await userEvent.click(dialog.getByText('Initial configuration').first());
    await userEvent.click(dialog.getByTestId('import-button'));

    expect(updateConfigurationMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      obsInstrument: 'GMOS_NORTH',
      pk: 1,
    });
    expect(setTemporaryInstrumentMock.request.variables).toHaveBeenCalledExactlyOnceWith(
      createInstrumentConfig({ createdAt: now }),
    );
  });
});

const getConfigurationMock = {
  request: {
    query: GET_CONFIGURATION,
    variables: {},
  },
  result: {
    data: {
      configuration: createConfiguration(),
    },
  },
} satisfies MockedResponseOf<typeof GET_CONFIGURATION>;

const getInstrumentPortMock = {
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
} satisfies MockedResponseOf<typeof GET_INSTRUMENT_PORT>;

const now = new Date();
const createdAt = now.toISOString();

const getInstrumentMock = {
  request: {
    query: GET_INSTRUMENT,
    variables: vi.fn().mockReturnValue(true),
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      instrument: createInstrumentConfig({ createdAt }),
    },
  },
} satisfies MockedResponseOf<typeof GET_INSTRUMENT>;

const distinctInstrumentsMock = {
  request: {
    query: GET_DISTINCT_INSTRUMENTS,
    variables: {},
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      distinctInstruments: [
        'ACQ_CAM',
        'FLAMINGOS2',
        'GHOST',
        'GMOS_NORTH',
        'GMOS_SOUTH',
        'GSAOI',
        'VISITOR',
        'IGRINS2',
      ],
    },
  },
} satisfies MockedResponseOf<typeof GET_DISTINCT_INSTRUMENTS>;

const distinctPortsMock = {
  request: {
    query: GET_DISTINCT_PORTS,
    variables: () => true,
  },
  result: {
    data: {
      distinctPorts: [3],
    },
  },
} satisfies MockedResponseOf<typeof GET_DISTINCT_PORTS>;

const getInstrumentsMock = {
  request: {
    query: GET_INSTRUMENTS,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: {
      instruments: [
        createInstrumentConfig({
          pk: 1,
          createdAt,
        }),
        createInstrumentConfig({
          pk: 2,
          wfs: 'OIWFS',
          createdAt: '2025-10-13T09:44:57.930Z',
        }),
      ],
    },
  },
} satisfies MockedResponseOf<typeof GET_INSTRUMENTS>;

const setTemporaryInstrumentMock = {
  request: {
    query: SET_TEMPORARY_INSTRUMENT,
    variables: vi.fn().mockReturnValue(true),
  },

  result: (arg) => ({
    data: {
      setTemporaryInstrument: {
        ...getInstrumentMock.result.data.instrument,
        ...(arg as InstrumentConfig),
        pk: 1,
        isTemporary: true,
        comment: null,
        createdAt,
      },
    },
  }),
} satisfies MockedResponseOf<typeof SET_TEMPORARY_INSTRUMENT>;

const updateConfigurationMock = {
  request: {
    query: UPDATE_CONFIGURATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: (arg) => ({
    data: {
      updateConfiguration: {
        ...getConfigurationMock.result.data.configuration,
        ...(arg as Configuration),
      },
    },
  }),
} satisfies MockedResponseOf<typeof UPDATE_CONFIGURATION>;
