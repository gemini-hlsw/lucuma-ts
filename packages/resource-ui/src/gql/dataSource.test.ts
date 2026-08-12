/**
 * The data-source selection and the live-failure store.
 *
 * `switchDataSource` itself is not called here - it reloads the page, which is
 * exactly what a test must not do. Persistence is exercised through the same
 * storage key it writes.
 */
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { liveFailureMessage } from './ApolloConfigs';
import { DATA_SOURCE_LABEL, readDataSource, reportLiveFailure, useLiveFailure } from './dataSource';

const STORAGE_KEY = 'resource-ui.data-source';

describe('readDataSource', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it('defaults to the demo, which always works', () => {
    expect(readDataSource()).toBe('DEMO');
  });

  it('reads a persisted live choice', () => {
    window.localStorage.setItem(STORAGE_KEY, 'LIVE');
    expect(readDataSource()).toBe('LIVE');
  });

  it('reads anything unrecognised as the demo, never an error', () => {
    window.localStorage.setItem(STORAGE_KEY, 'production');
    expect(readDataSource()).toBe('DEMO');
  });

  it('labels both sources for the masthead control', () => {
    expect(DATA_SOURCE_LABEL.DEMO).toBe('Demo data');
    expect(DATA_SOURCE_LABEL.LIVE).toBe('Live server');
  });
});

describe('the live-failure store', () => {
  it('delivers the last failure to the hook the banner reads', async () => {
    const hook = await renderHook(() => useLiveFailure());

    await hook.act(() => {
      reportLiveFailure('the server went away');
    });

    expect(hook.result.current).toBe('the server went away');
  });
});

describe('liveFailureMessage', () => {
  it('says the server does not serve this API when it answered with GraphQL errors', () => {
    const error = new CombinedGraphQLErrors({ errors: [{ message: 'Cannot query field "publishedSemesters"' }] });

    expect(liveFailureMessage(error)).toBe(
      'The live server answered, but it does not serve this version of the Resource API yet.',
    );
  });

  it('says the server could not be reached for a network failure, with the detail', () => {
    expect(liveFailureMessage(new Error('Failed to fetch'))).toBe(
      'The live server could not be reached (Failed to fetch).',
    );
  });

  it('stays whole when the error carries no message', () => {
    expect(liveFailureMessage('boom')).toBe('The live server could not be reached.');
  });
});
