import { fakeJwt, serviceUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import type { GuideEnableMutation } from '@gql/server/gen/graphql';

/** Twenty years, so the token outlives any test run. */
const TWENTY_YEARS = 20 * 365 * 24 * 60 * 60;

/** A service user's JWT. It is unsigned, so use it in unit tests only. */
export const longExpirationJwt = fakeJwt(serviceUser(), TWENTY_YEARS);

/** A JWT for a service user that expired a minute ago. */
export const expiredJwt = fakeJwt(serviceUser(), -60);

/**
 * A generic successful OperationOutcome object for use in tests
 */
export const operationOutcome: OperationOutcome = {
  __typename: 'OperationOutcome',
  result: 'SUCCESS',
  msg: null,
};

export type OperationOutcome = GuideEnableMutation['guideEnable'];
