import type { GetCentralWavelengthQuery } from '@gql/odb/gen/graphql';

import { extractCentralWavelength } from './wavelength';

describe(extractCentralWavelength.name, () => {
  it('returns undefined if no data is provided', () => {
    expect(extractCentralWavelength(undefined)).toBeUndefined();
  });

  it('returns undefined if executionConfig is not present', () => {
    const data = {
      executionConfig: null,
    };
    expect(extractCentralWavelength(data)).toBeUndefined();
  });

  it('returns undefined for unsupported instruments', () => {
    const data: GetCentralWavelengthQuery = {
      executionConfig: {
        instrument: 'SCORPIO',
        flamingos2: null,
        gmosNorth: null,
        gmosSouth: null,
        ghost: null,
        igrins2: null,
        __typename: 'ExecutionConfig',
      },
    };
    expect(extractCentralWavelength(data)).toBeUndefined();
  });

  it('returns the central wavelength for FLAMINGOS2', () => {
    const data: GetCentralWavelengthQuery = {
      executionConfig: {
        instrument: 'FLAMINGOS2',
        flamingos2: {
          __typename: 'Flamingos2ExecutionConfig',
          acquisition: {
            __typename: 'Flamingos2ExecutionSequence',
            nextAtom: {
              __typename: 'Flamingos2Atom',
              id: 'atom1',
              steps: [
                {
                  __typename: 'Flamingos2Step',
                  id: 'step1',
                  instrumentConfig: {
                    fpu: null,
                    __typename: 'Flamingos2Dynamic',
                    centralWavelength: {
                      __typename: 'Wavelength',
                      nanometers: 1500,
                    },
                  },
                },
                {
                  __typename: 'Flamingos2Step',
                  id: 'step2',
                  instrumentConfig: {
                    fpu: null,
                    __typename: 'Flamingos2Dynamic',
                    centralWavelength: {
                      __typename: 'Wavelength',
                      nanometers: 2500,
                    },
                  },
                },
              ],
            },
          },
          science: {
            __typename: 'Flamingos2ExecutionSequence',
            nextAtom: {
              __typename: 'Flamingos2Atom',
              id: 'atom3',
              steps: [
                {
                  __typename: 'Flamingos2Step',
                  id: 'step3',
                  instrumentConfig: {
                    fpu: null,
                    __typename: 'Flamingos2Dynamic',
                    centralWavelength: {
                      __typename: 'Wavelength',
                      nanometers: 3500,
                    },
                  },
                },
                {
                  __typename: 'Flamingos2Step',
                  id: 'step4',
                  instrumentConfig: {
                    fpu: null,
                    __typename: 'Flamingos2Dynamic',
                    centralWavelength: {
                      __typename: 'Wavelength',
                      nanometers: 4500,
                    },
                  },
                },
              ],
            },
          },
        },
        gmosNorth: null,
        gmosSouth: null,
        ghost: null,
        igrins2: null,
        __typename: 'ExecutionConfig',
      },
    };
    expect(extractCentralWavelength(data)).deep.eq({ wavelength: 1500, fpu: null });
  });

  it('returns science central wavelength if acquisition is not present', () => {
    const data: GetCentralWavelengthQuery = {
      executionConfig: {
        instrument: 'FLAMINGOS2',
        flamingos2: {
          __typename: 'Flamingos2ExecutionConfig',
          acquisition: {
            __typename: 'Flamingos2ExecutionSequence',
            nextAtom: {
              __typename: 'Flamingos2Atom',
              id: 'atom1',
              steps: [],
            },
          },
          science: {
            __typename: 'Flamingos2ExecutionSequence',
            nextAtom: {
              __typename: 'Flamingos2Atom',
              id: 'atom3',
              steps: [
                {
                  __typename: 'Flamingos2Step',
                  id: 'step3',
                  instrumentConfig: {
                    fpu: null,
                    __typename: 'Flamingos2Dynamic',
                    centralWavelength: {
                      __typename: 'Wavelength',
                      nanometers: 3500,
                    },
                  },
                },
                {
                  __typename: 'Flamingos2Step',
                  id: 'step4',
                  instrumentConfig: {
                    fpu: null,
                    __typename: 'Flamingos2Dynamic',
                    centralWavelength: {
                      __typename: 'Wavelength',
                      nanometers: 4500,
                    },
                  },
                },
              ],
            },
          },
        },
        gmosNorth: null,
        gmosSouth: null,
        ghost: null,
        igrins2: null,
        __typename: 'ExecutionConfig',
      },
    };
    expect(extractCentralWavelength(data)).deep.eq({ wavelength: 3500, fpu: null });
  });

  it('returns the central wavelength for GMOS_NORTH', () => {
    const data: GetCentralWavelengthQuery = {
      executionConfig: {
        instrument: 'GMOS_NORTH',
        gmosNorth: {
          __typename: 'GmosNorthExecutionConfig',
          acquisition: {
            __typename: 'GmosNorthExecutionSequence',
            nextAtom: {
              __typename: 'GmosNorthAtom',
              id: 'atom1',
              steps: [
                {
                  __typename: 'GmosNorthStep',
                  id: 'step1',
                  instrumentConfig: {
                    fpu: null,
                    __typename: 'GmosNorthDynamic',
                    centralWavelength: {
                      __typename: 'Wavelength',
                      nanometers: 500,
                    },
                  },
                },
              ],
            },
          },
          science: null,
        },
        gmosSouth: null,
        flamingos2: null,
        ghost: null,
        igrins2: null,
        __typename: 'ExecutionConfig',
      },
    };
    expect(extractCentralWavelength(data)).deep.eq({ wavelength: 500, fpu: null });
  });

  it('returns central wavelength for GMOS_SOUTH', () => {
    const data: GetCentralWavelengthQuery = {
      executionConfig: {
        instrument: 'GMOS_SOUTH',
        flamingos2: null,
        gmosNorth: null,
        gmosSouth: {
          __typename: 'GmosSouthExecutionConfig',
          acquisition: {
            __typename: 'GmosSouthExecutionSequence',
            nextAtom: {
              __typename: 'GmosSouthAtom',
              id: 'atom1',
              steps: [
                {
                  __typename: 'GmosSouthStep',
                  id: 'step1',
                  instrumentConfig: {
                    fpu: null,
                    __typename: 'GmosSouthDynamic',
                    centralWavelength: {
                      __typename: 'Wavelength',
                      nanometers: 1500,
                    },
                  },
                },
              ],
            },
          },
          science: null,
        },
        ghost: null,
        igrins2: null,
        __typename: 'ExecutionConfig',
      },
    };
    expect(extractCentralWavelength(data)).deep.eq({ wavelength: 1500, fpu: null });
  });

  it('returns central wavelength for GHOST', () => {
    const data: GetCentralWavelengthQuery = {
      executionConfig: {
        instrument: 'GHOST',
        flamingos2: null,
        gmosNorth: null,
        gmosSouth: null,
        ghost: {
          __typename: 'GhostExecutionConfig',
          science: {
            __typename: 'GhostExecutionSequence',
            nextAtom: {
              __typename: 'GhostAtom',
              id: 'atom1',
              steps: [
                {
                  __typename: 'GhostStep',
                  id: 'step1',
                  instrumentConfig: {
                    __typename: 'GhostDynamic',
                    centralWavelength: {
                      __typename: 'Wavelength',
                      nanometers: 2000,
                    },
                  },
                },
                {
                  __typename: 'GhostStep',
                  id: 'step2',
                  instrumentConfig: {
                    __typename: 'GhostDynamic',
                    centralWavelength: {
                      __typename: 'Wavelength',
                      nanometers: 2500,
                    },
                  },
                },
              ],
            },
          },
        },
        igrins2: null,
        __typename: 'ExecutionConfig',
      },
    };
    expect(extractCentralWavelength(data)).deep.eq({ wavelength: 2000, fpu: null });
  });

  it('returns central wavelength for IGRINS2', () => {
    const data: GetCentralWavelengthQuery = {
      executionConfig: {
        instrument: 'IGRINS2',
        flamingos2: null,
        gmosNorth: null,
        gmosSouth: null,
        ghost: null,
        igrins2: {
          __typename: 'Igrins2ExecutionConfig',
          science: {
            __typename: 'Igrins2ExecutionSequence',
            nextAtom: {
              __typename: 'Igrins2Atom',
              id: 'atom1',
              steps: [
                {
                  __typename: 'Igrins2Step',
                  id: 'step1',
                  instrumentConfig: {
                    __typename: 'Igrins2Dynamic',
                    centralWavelength: {
                      __typename: 'Wavelength',
                      nanometers: 2500,
                    },
                  },
                },
              ],
            },
          },
        },
        __typename: 'ExecutionConfig',
      },
    };
    expect(extractCentralWavelength(data)).deep.eq({ wavelength: 2500, fpu: null });
  });
});
