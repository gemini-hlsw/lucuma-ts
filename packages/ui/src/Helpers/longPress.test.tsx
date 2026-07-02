import { useState } from 'react';
import type { Mock } from 'vitest';
import { render } from 'vitest-browser-react';

import { useLongPress } from './longPress';

const DELAY = 50;

// Drives the hook the way a consumer does: spreading its handlers onto a real
// element. It surfaces "long pressed" in the DOM so tests can wait on the real
// React commit (rather than a sleep) before releasing.
function LongPressHarness({
  onLongPress,
  onClick,
}: {
  onLongPress: (e: React.MouseEvent | React.TouchEvent) => void;
  onClick: (e: React.MouseEvent | React.TouchEvent) => void;
}) {
  const [longPressed, setLongPressed] = useState(false);
  const handlers = useLongPress(
    (e) => {
      setLongPressed(true);
      onLongPress(e);
    },
    onClick,
    { delay: DELAY },
  );
  return (
    <button type="button" data-testid="target" {...handlers}>
      {longPressed ? 'long-pressed' : 'idle'}
    </button>
  );
}

describe(useLongPress.name, () => {
  let onLongPress: Mock;
  let onClick: Mock;

  beforeEach(() => {
    onLongPress = vi.fn();
    onClick = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderHarness() {
    const sut = await render(<LongPressHarness onLongPress={onLongPress} onClick={onClick} />);
    const element = sut.container.querySelector('[data-testid="target"]')!;
    const press = (type: string) => element.dispatchEvent(new MouseEvent(type, { bubbles: true }));
    const touch = (type: string) => element.dispatchEvent(new TouchEvent(type, { bubbles: true }));
    return { sut, press, touch };
  }

  it('treats a quick press and release as a click', async () => {
    const { press } = await renderHarness();

    press('mousedown');
    press('mouseup');

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('triggers a long press when held, and does not also click on release', async () => {
    const { sut, press } = await renderHarness();

    press('mousedown');

    // Wait for the real long-press commit (not a sleep) before releasing.
    await expect.element(sut.getByTestId('target')).toHaveTextContent('long-pressed');
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    press('mouseup');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('treats a touch tap as a click', async () => {
    const { touch } = await renderHarness();

    touch('touchstart');
    touch('touchend');

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('ignores the synthetic mouse events a browser emits after a touch tap', async () => {
    const { press, touch } = await renderHarness();

    touch('touchstart');
    touch('touchend');
    // The browser emulates a mouse press/release after a tap; these must not double-fire onClick.
    press('mousedown');
    press('mouseup');

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels a pending long press when unmounted mid-press', async () => {
    const { sut, press } = await renderHarness();

    // Fake timers let us assert the timer never fires without waiting out the delay.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    press('mousedown');
    await sut.unmount();

    vi.advanceTimersByTime(DELAY);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
