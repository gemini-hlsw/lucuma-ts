import type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';
import type {
  ComponentBrowserQuery,
  ComponentBrowserQueryVariables,
  InstrumentComponentAvailabilityBlockItemFragment,
} from '@gql/gen/graphql';
import { COMPONENT_BROWSER_QUERY } from '@gql/resource';

import { overNights } from './blocks';

type InstrumentComponent = InstrumentComponentAvailabilityBlockItemFragment['component'];

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

/** Carries the piece's whole identity, so one block serves the night views and the component browser alike. */
export const instrumentComponentAvailabilityBlock = ({
  component = instrumentComponent(),
  interval = overNights('GS', '2025-08-02', '2026-02-01'),
  usage = 'SCIENCE',
  location = 'INSTALLED',
  note = null,
}: Partial<
  Omit<InstrumentComponentAvailabilityBlockItemFragment, '__typename'>
> = {}): InstrumentComponentAvailabilityBlockItemFragment => ({
  __typename: 'InstrumentComponentAvailabilityBlock',
  usage,
  location,
  note,
  interval,
  component,
});

/** Pass the window from `siteSpan`: the browser asks for the site's whole record. */
export const componentBrowser = (
  variables: ComponentBrowserQueryVariables,
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
