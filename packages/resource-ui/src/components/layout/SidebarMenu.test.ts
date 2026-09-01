import { describe, expect, it } from 'vitest';

import { SIDEBAR_MENU_SECTIONS } from './SidebarMenu';

const items = SIDEBAR_MENU_SECTIONS.flatMap((section) => section.items);

describe('SIDEBAR_MENU_SECTIONS', () => {
  it('ensures every section label is unique', () => {
    const labels = SIDEBAR_MENU_SECTIONS.map((section) => section.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('ensures navigation item routes are unique across all sections', () => {
    const routes = items.map((item) => item.to);

    expect(new Set(routes).size).toBe(routes.length);
  });

  it('ensures navigation item labels are unique across all sections', () => {
    const labels = items.map((item) => item.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('ensures all routes are absolute', () => {
    for (const item of items) {
      expect(item.to).toMatch(/^\/.+/);
    }
  });

  it('ensures item labels are never empty', () => {
    expect(items.every((item) => item.label.trim() !== '')).toBe(true);
  });

  it('ensures routes do not end with a trailing slash', () => {
    for (const item of items) {
      expect(item.to).not.toMatch(/\/$/);
    }
  });
});
