import { createStore, Provider as JotaiProvider } from 'jotai';
import { PrimeReactProvider } from 'primereact/api';
import { type ReactNode, useEffect, useState } from 'react';
import { render } from 'vitest-browser-react';

import { ToastOutlet } from './components/ToastOutlet.tsx';
import { type ToastApi, toastAtom, useToastApi } from './toast.ts';

const LEVELS = ['success', 'info', 'warn', 'error'] as const;

/** Reports its api to `onApi`. Its buttons raise one toast per severity. */
function Notifier({ onApi }: { onApi: (api: ToastApi) => void }) {
  const api = useToastApi();
  useEffect(() => {
    onApi(api);
  }, [api, onApi]);
  return (
    <>
      {LEVELS.map((level) => (
        <button key={level} onClick={() => api[level](`Summary ${level}`, `Detail ${level}`)}>
          {level}
        </button>
      ))}
      <button onClick={() => api.success('Saved')}>no detail</button>
    </>
  );
}

/** Renders `before`, a `Notifier`, and the outlet unless `outlet: false`. */
async function renderApi({ outlet = true, before }: { outlet?: boolean; before?: ReactNode } = {}) {
  const store = createStore();
  const apis: ToastApi[] = [];
  const tree = (withOutlet: boolean) => (
    <PrimeReactProvider>
      <JotaiProvider store={store}>
        {before}
        <Notifier onApi={(a) => apis.push(a)} />
        {withOutlet && <ToastOutlet />}
      </JotaiProvider>
    </PrimeReactProvider>
  );
  const waitForOutlet = () => expect.poll(() => store.get(toastAtom)).not.toBeNull();
  const screen = await render(tree(outlet));
  await expect.poll(() => apis.length).toBeGreaterThan(0);
  if (outlet) await waitForOutlet();
  const mountOutlet = async () => {
    await screen.rerender(tree(true));
    await waitForOutlet();
  };
  return { store, screen, apis, api: apis[0]!, mountOutlet };
}

describe(useToastApi, () => {
  it.each(LEVELS)('shows a %s toast with summary and detail', async (level) => {
    const { screen } = await renderApi();

    await screen.getByRole('button', { name: level, exact: true }).click();

    const alert = screen.getByRole('alert');
    await expect.element(alert.getByText(`Summary ${level}`)).toBeVisible();
    await expect.element(alert.getByText(`Detail ${level}`)).toBeVisible();
    expect(document.querySelector(`.p-toast-message-${level}`)).not.toBeNull();
  });

  it('shows a toast without a detail', async () => {
    const { screen } = await renderApi();

    await screen.getByRole('button', { name: 'no detail' }).click();

    await expect.element(screen.getByText('Saved')).toBeVisible();
  });

  it('asks for a 3 second life on success and info toasts, and 5 seconds on warn and error', async () => {
    const { store, screen } = await renderApi();
    const show = vi.spyOn(store.get(toastAtom)!, 'show');

    for (const level of LEVELS) {
      await screen.getByRole('button', { name: level, exact: true }).click();
    }

    expect(show.mock.calls.map(([message]) => message)).toEqual([
      expect.objectContaining({ severity: 'success', life: 3000 }),
      expect.objectContaining({ severity: 'info', life: 3000 }),
      expect.objectContaining({ severity: 'warn', life: 5000 }),
      expect.objectContaining({ severity: 'error', life: 5000 }),
    ]);
  });

  it('reaches the outlet from a mount effect, even one that runs before the outlet in the tree', async () => {
    function ToastOnMount() {
      const toast = useToastApi();
      useEffect(() => {
        toast.info('Welcome back');
      }, [toast]);
      return null;
    }
    const { screen } = await renderApi({ before: <ToastOnMount /> });

    await expect.element(screen.getByText('Welcome back')).toBeVisible();
  });

  it('removes the toast when an effect that showed it cleans up', async () => {
    function ToastWhile() {
      const toast = useToastApi();
      useEffect(() => toast.warn('Offline'), [toast]);
      return null;
    }
    function Toggle() {
      const [on, setOn] = useState(true);
      return (
        <>
          <button onClick={() => setOn(false)}>hide</button>
          {on && <ToastWhile />}
        </>
      );
    }
    const { screen } = await renderApi({ before: <Toggle /> });
    await expect.element(screen.getByText('Offline')).toBeVisible();

    await screen.getByRole('button', { name: 'hide' }).click();

    await expect.element(screen.getByText('Offline')).not.toBeInTheDocument();
  });

  it('keeps other toasts when one is removed', async () => {
    const { api, screen } = await renderApi();
    api.info('Stays');
    const remove = api.info('Goes');
    await expect.element(screen.getByText('Goes')).toBeVisible();

    remove();

    await expect.element(screen.getByText('Goes')).not.toBeInTheDocument();
    await expect.element(screen.getByText('Stays')).toBeVisible();
  });

  it('is a safe no-op while no outlet is mounted', async () => {
    const { api } = await renderApi({ outlet: false });

    expect(() => {
      api.success('a', 'b')();
      api.info('a')();
      api.warn('a')();
      api.error('a')();
    }).not.toThrow();
  });

  it('returns the same api across renders, and reaches an outlet that mounts later', async () => {
    const { api, apis, screen, mountOutlet } = await renderApi({ outlet: false });

    await mountOutlet();
    api.success('Late outlet');

    await expect.element(screen.getByText('Late outlet')).toBeVisible();
    expect(new Set(apis).size).toBe(1);
  });
});
