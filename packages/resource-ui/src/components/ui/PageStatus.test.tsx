/**
 * The three states a page shows instead of content.
 *
 * Tested directly rather than through a page because the failure path is the
 * one no page test reaches: every page test runs against a mock that answers,
 * so a broken `ErrorAlert` would ship silently even though five pages render
 * it. What matters here is not the ink but the two things a reader depends on -
 * that a failure is announced and quotes the error verbatim, and that an
 * absence is not announced as one.
 */
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { EmptyPanel, ErrorAlert, Loading } from './PageStatus';

describe(ErrorAlert, () => {
  it('announces the failure and quotes the error, so a reader can report it', async () => {
    const screen = await render(<ErrorAlert what="the night" error={new Error('Network request failed')} />);

    // `role="alert"` is the point: a failure that arrives after the page has
    // rendered must reach a screen reader without them going looking for it.
    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('Could not load the night: Network request failed');
  });
});

describe(Loading, () => {
  it('says what it is waiting for, and is not an alert', async () => {
    const screen = await render(<Loading what="the catalog" />);

    await expect.element(screen.getByText('Loading the catalog…')).toBeVisible();
    expect(screen.container.querySelector('[role="alert"]')).toBeNull();
  });
});

describe(EmptyPanel, () => {
  it('states an absence without announcing it as a failure', async () => {
    // I4 reaching the chrome: "nothing is recorded" is an answer, not an error,
    // so it must not carry the alert role or the reserved red.
    const screen = await render(<EmptyPanel>Nothing is recorded for this night.</EmptyPanel>);

    await expect.element(screen.getByText('Nothing is recorded for this night.')).toBeVisible();
    expect(screen.container.querySelector('[role="alert"]')).toBeNull();
  });
});
