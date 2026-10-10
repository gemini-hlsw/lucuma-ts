import { describe, expect, it } from 'vitest';

import { mergePage } from './useAllPages';

const page = (ids: string[], hasMore: boolean) => ({ matches: ids.map((id) => ({ id })), hasMore });

describe(mergePage, () => {
  it('appends the next page, taking its hasMore', () => {
    expect(mergePage(page(['a', 'b'], true), page(['c', 'd'], false))).toEqual(page(['a', 'b', 'c', 'd'], false));
  });

  it('keeps one row when a page repeats the previous page’s last row', () => {
    expect(mergePage(page(['a', 'b'], true), page(['b', 'c'], true))).toEqual(page(['a', 'b', 'c'], true));
  });

  it('settles when the final page holds only the repeated row', () => {
    expect(mergePage(page(['a', 'b'], true), page(['b'], false))).toEqual(page(['a', 'b'], false));
  });

  it('hands back the page held when a page claims more but adds nothing', () => {
    const held = page(['a', 'b'], true);
    expect(mergePage(held, page(['a', 'b'], true))).toBe(held);
  });
});
