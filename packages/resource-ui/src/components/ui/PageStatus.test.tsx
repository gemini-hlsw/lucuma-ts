/** The failure path no page test reaches: every page test runs against a mock that answers. */
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { EmptyPanel, ErrorAlert, Loading } from './PageStatus';

describe(ErrorAlert, () => {
  it('announces the failure and quotes the error, so a reader can report it', async () => {
    const screen = await render(<ErrorAlert what="the night" error={new Error('Network request failed')} />);

    // `role="alert"`: a failure arriving after render must reach a screen reader unprompted.
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
    // I4 in the chrome: "nothing is recorded" is an answer, so no alert role and no red.
    const screen = await render(<EmptyPanel>Nothing is recorded for this night.</EmptyPanel>);

    await expect.element(screen.getByText('Nothing is recorded for this night.')).toBeVisible();
    expect(screen.container.querySelector('[role="alert"]')).toBeNull();
  });
});
