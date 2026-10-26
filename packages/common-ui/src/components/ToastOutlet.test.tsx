import { createStore, Provider as JotaiProvider } from 'jotai';
import { PrimeReactProvider } from 'primereact/api';
import type { ToastMessage, ToastProps } from 'primereact/toast';
import { type ReactNode, useEffect } from 'react';
import { render } from 'vitest-browser-react';

import { toastAtom, useToast } from '../toast.ts';
import { ToastOutlet } from './ToastOutlet.tsx';

const SAVED = { severity: 'success', summary: 'Run saved', detail: 'The night is up to date.' } satisfies ToastMessage;
const EXPIRED = {
  severity: 'warn',
  summary: 'Session ended',
  detail: 'Sign in again.',
  sticky: true,
} satisfies ToastMessage;

function ShowButton({ message }: { message: ToastMessage }) {
  const toast = useToast();
  return <button onClick={() => toast?.show(message)}>Show</button>;
}

function ShowOnHandle({ message }: { message: ToastMessage }) {
  const toast = useToast();
  useEffect(() => {
    toast?.show(message);
  }, [toast, message]);
  return null;
}

/** Renders the outlet beside `children`. Waits for its handle, returned as `toast`. */
const renderOutlet = async (children?: ReactNode, outletProps: ToastProps = {}) => {
  const store = createStore();
  const screen = await render(
    <PrimeReactProvider>
      <JotaiProvider store={store}>
        {children}
        <ToastOutlet {...outletProps} />
      </JotaiProvider>
    </PrimeReactProvider>,
  );
  await expect.poll(() => store.get(toastAtom)).not.toBeNull();
  return { store, screen, toast: store.get(toastAtom)! };
};

describe(ToastOutlet, () => {
  it('shows a toast from a component that asks for the handle', async () => {
    const { screen } = await renderOutlet(<ShowButton message={SAVED} />);

    await screen.getByRole('button', { name: 'Show' }).click();

    const alert = screen.getByRole('alert');
    await expect.element(alert.getByText(SAVED.summary)).toBeVisible();
    await expect.element(alert.getByText(SAVED.detail)).toBeVisible();
  });

  it('publishes the handle for code outside React, through the store', async () => {
    const { toast, screen } = await renderOutlet();

    toast.show(SAVED);

    await expect.element(screen.getByText(SAVED.summary)).toBeVisible();
  });

  it('clears the handle when the outlet unmounts', async () => {
    const { store, screen } = await renderOutlet();

    await screen.unmount();

    expect(store.get(toastAtom)).toBeNull();
  });

  it('keeps one handle across a show and a remove, so an effect on it shows once', async () => {
    const { store, screen, toast } = await renderOutlet(<ShowOnHandle message={SAVED} />);

    await expect.element(screen.getByText(SAVED.summary)).toBeVisible();
    expect(document.querySelectorAll('.p-toast-message')).toHaveLength(1);
    toast.remove(SAVED);

    await expect.element(screen.getByText(SAVED.summary)).not.toBeInTheDocument();
    expect(store.get(toastAtom)).toBe(toast);
  });

  it('removes only the message it is handed back', async () => {
    const { toast, screen } = await renderOutlet();

    toast.show(SAVED);
    toast.show(EXPIRED);
    await expect.element(screen.getByText(EXPIRED.summary)).toBeVisible();
    toast.remove(SAVED);

    await expect.element(screen.getByText(SAVED.summary)).not.toBeInTheDocument();
    await expect.element(screen.getByText(EXPIRED.summary)).toBeVisible();
  });

  it('passes position and className through to the toast container', async () => {
    const { toast, screen } = await renderOutlet(undefined, { position: 'bottom-right', className: 'custom-outlet' });
    toast.show(EXPIRED);

    await expect.element(screen.getByText(EXPIRED.summary)).toBeVisible();
    const container = document.querySelector<HTMLElement>('.p-toast')!;
    expect(container).toHaveClass('custom-outlet');
    const { right, bottom } = container.getBoundingClientRect();
    expect(right).toBeGreaterThan(window.innerWidth - 100);
    expect(bottom).toBeGreaterThan(window.innerHeight - 100);
  });
});
