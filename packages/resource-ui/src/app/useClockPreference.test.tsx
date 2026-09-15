import { describe, expect, it, vi } from 'vitest';

import { Probe } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import { setClockPreference, useClockPreference } from './useClockPreference';

const openClock = async () =>
  renderApp({
    route: '/night?site=GS',
    element: <Probe use={useClockPreference} readout={(clock) => ({ clock })} />,
  });

describe(useClockPreference, () => {
  it('starts on the site clock, which is what a reader at the telescope works in', async () => {
    const screen = await openClock();

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('site');
  });

  it('reads a habit the browser already holds', async () => {
    localStorage.setItem('resource.clock', 'utc');
    const screen = await openClock();

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('utc');
  });

  it('degrades a value it does not recognise, rather than rendering it', async () => {
    // Storage is shared with whatever wrote it last, including an older build of this app.
    localStorage.setItem('resource.clock', 'martian');
    const screen = await openClock();

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('site');
  });

  it('re-renders every reader on a write, not just the one that wrote', async () => {
    const screen = await openClock();
    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('site');

    // Written from outside React entirely: the store is what the subscribers hear.
    setClockPreference('utc');

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('utc');
  });

  it('holds the choice for the session even when storage refuses the write', async () => {
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

  it('keeps the habit out of the URL, which is what makes a shared link the recipient s own', async () => {
    const screen = await openClock();

    setClockPreference('utc');

    await expect.element(screen.getByTestId('probe-clock')).toHaveTextContent('utc');
    expect(screen.router.state.location.search).toBe('?site=GS');
  });

  it('picks up a write from another tab through the storage event, not just a write from this one', async () => {
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

  it('writes the choice to storage, not just the closure, so a reload survives it', async () => {
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

  it('degrades to the default rather than crashing when storage refuses to be read', async () => {
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

  it('does not crash the reader when storage refuses to be written', async () => {
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
