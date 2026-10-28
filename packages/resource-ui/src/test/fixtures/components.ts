import type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';
import type { ComponentBrowserQuery, ComponentBrowserQueryVariables } from '@gql/gen/graphql';
import { COMPONENT_BROWSER_QUERY } from '@gql/resource';

import { overNights } from './blocks';

type InstrumentComponent = ComponentBrowserQuery['components'][number];
type ComponentAvailabilityBlock = ComponentBrowserQuery['instrumentComponentAvailability'][number];

export const instrumentComponent = ({
  id = 'k-gs-g_G0325',
  instrument = 'GMOS',
  componentType = 'FILTER',
  code = 'g_G0325',
  name = 'g',
  barcode = null,
  aliases = [],
}: Partial<Omit<InstrumentComponent, '__typename'>> = {}): InstrumentComponent => ({
  __typename: 'InstrumentComponent',
  id,
  instrument,
  componentType,
  code,
  name,
  barcode,
  aliases,
});

export const instrumentComponentAvailabilityBlock = ({
  component = instrumentComponent(),
  interval = overNights('GS', '2025-08-02', '2026-02-01'),
  usage = 'SCIENCE',
  location = 'INSTALLED',
  note = null,
}: Partial<Omit<ComponentAvailabilityBlock, '__typename'>> = {}): ComponentAvailabilityBlock => ({
  __typename: 'InstrumentComponentAvailabilityBlock',
  usage,
  location,
  note,
  interval,
  component,
});

export const componentBrowser = (
  variables: ComponentBrowserQueryVariables | ((variables: ComponentBrowserQueryVariables) => boolean),
  data: Partial<ComponentBrowserQuery> = {},
): MockedResponseOf<typeof COMPONENT_BROWSER_QUERY> => ({
  request: { query: COMPONENT_BROWSER_QUERY, variables },
  result: {
    data: {
      components: [],
      instrumentComponentAvailability: [],
      instrumentAvailability: [],
      ...data,
    },
  },
});
