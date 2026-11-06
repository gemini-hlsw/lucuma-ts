import { describe, expect, it, vi } from 'vitest';

import { Probe } from '@/test/probe';
import { renderWithRoute } from '@/test/render';

import { setClockPreference, useClockPreference } from './useClockPreference';

const openClock = async () =>
  renderWithRoute(<Probe use={useClockPreference} readout={({ value }) => ({ clock: value })} />, {
    route: '/night?site=GS',
  });

describe(useClockPreference, () => {
  it('should start on the site clock, the one a reader at the telescope works in, when the browser holds no habit', async () => {
    const screen = await openClock();

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('site');
  });

  it('should read the habit when the browser already holds one', async () => {
    localStorage.setItem('resource.clock', 'utc');
    const screen = await openClock();

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('utc');
  });

  it('should degrade to the default rather than render the value when storage holds one it does not recognise', async () => {
    // Storage is shared with whatever wrote it last, including an older build of this app.
    localStorage.setItem('resource.clock', 'martian');
    const screen = await openClock();

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('site');
  });

  it('should re-render every reader, not just the one that wrote, when the choice is written', async () => {
    const screen = await openClock();
    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('site');

    // Written from outside React entirely: the store is what the subscribers hear.
    setClockPreference('utc');

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('utc');
  });

  it('should hold the choice for the session when storage refuses the write', async () => {
    const screen = await openClock();
    // Private mode and blocked cookies both throw here; the control must not become a no-op.
    const denied = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'QuotaExceededError');
    });

    try {
      setClockPreference('utc');
      await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('utc');
    } finally {
      denied.mockRestore();
    }
  });

  it("should keep the habit out of the URL, so a shared link stays the recipient's own, when a clock is chosen", async () => {
    const screen = await openClock();

    setClockPreference('utc');

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('utc');
    expect(screen.router.location.search).toBe('?site=GS');
  });

  it('should pick up the write through the storage event, not just a write from this tab, when another tab writes', async () => {
    const screen = await openClock();
    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('site');

    // A second tab writes storage directly and the browser fires this event here - `setClockPreference`
    // calling `notify()` itself is a different path and proves nothing about this one.
    localStorage.setItem('resource.clock', 'utc');
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'resource.clock', newValue: 'utc', storageArea: localStorage }),
    );

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('utc');
  });

  it('should write the choice to storage, not just the closure, so a reload survives it, when a clock is chosen', async () => {
    const screen = await openClock();

    setClockPreference('utc');

    expect(localStorage.getItem('resource.clock')).toBe('utc');

    // Invalidates the session closure the same way a reload or another tab would, so the
    // readout below can only be honest if the earlier write actually reached storage.
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'resource.clock', newValue: 'utc', storageArea: localStorage }),
    );

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('utc');
  });

  it('should degrade to the default rather than crash when storage refuses to be read', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    try {
      const screen = await openClock();

      await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('site');
    } finally {
      Storage.prototype.getItem = getItem;
    }
  });

  it('should not crash the reader when storage refuses to be written', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    };
    try {
      const screen = await openClock();
      await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('site');

      expect(() => {
        setClockPreference('utc');
      }).not.toThrow();
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });
});
