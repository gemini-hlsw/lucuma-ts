import { renderHook } from 'vitest-browser-react';

import { useSyncedState } from './hooks.ts';

describe(useSyncedState.name, () => {
  const renderSut = (initialIncoming?: number | null) =>
    renderHook((incoming?: number | null) => useSyncedState(incoming, 1), { initialProps: initialIncoming });

  it('keeps the initial value while incoming is nullish', async () => {
    const sut = await renderSut(undefined);
    expect(sut.result.current[0]).toBe(1);

    await sut.rerender(null);
    expect(sut.result.current[0]).toBe(1);
  });

  it('adopts a falsy incoming value', async () => {
    const sut = await renderSut(0);

    expect(sut.result.current[0]).toBe(0);
  });

  it('keeps a local edit while incoming is unchanged', async () => {
    const sut = await renderSut(0);
    await sut.act(() => sut.result.current[1](1));

    await sut.rerender(0);

    expect(sut.result.current[0]).toBe(1);
  });

  it('overrides a local edit when incoming changes', async () => {
    const sut = await renderSut(0);
    await sut.act(() => sut.result.current[1](1));

    await sut.rerender(2);

    expect(sut.result.current[0]).toBe(2);
  });

  it('keeps a local edit when incoming turns nullish, and syncs when it returns', async () => {
    const sut = await renderSut(0);
    await sut.act(() => sut.result.current[1](1));

    await sut.rerender(null);
    expect(sut.result.current[0]).toBe(1);

    await sut.rerender(0);
    expect(sut.result.current[0]).toBe(0);
  });
});
