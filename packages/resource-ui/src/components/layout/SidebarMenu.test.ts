import { describe, expect, it } from 'vitest';

import { routes } from '@/app/router';

import { SIDEBAR_MENU_ITEMS, SIDEBAR_MENU_SECTIONS } from './SidebarMenu';

/** The shell's children are the destinations; the index route only redirects into one. */
const served = (routes[0]?.children ?? [])
  .map((route) => route.path)
  .filter((path) => path !== undefined)
  .map((path) => `/${path}`);

describe('SIDEBAR_MENU_SECTIONS', () => {
  it('ensures every section label is unique', () => {
    const labels = SIDEBAR_MENU_SECTIONS.map((section) => section.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('ensures navigation item routes are unique across all sections', () => {
    const routes = SIDEBAR_MENU_ITEMS.map((item) => item.to);

    expect(new Set(routes).size).toBe(routes.length);
  });

  it('ensures navigation item labels are unique across all sections', () => {
    const labels = SIDEBAR_MENU_ITEMS.map((item) => item.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('ensures all routes are absolute', () => {
    for (const item of SIDEBAR_MENU_ITEMS) {
      expect(item.to).toMatch(/^\/.+/);
    }
  });

  it('ensures item labels are never empty', () => {
    expect(SIDEBAR_MENU_ITEMS.every((item) => item.label.trim() !== '')).toBe(true);
  });

  it('ensures routes do not end with a trailing slash', () => {
    for (const item of SIDEBAR_MENU_ITEMS) {
      expect(item.to).not.toMatch(/\/$/);
    }
  });

  // Navigation and the router are two lists of the same destinations, and neither states the other.
  it('points every item at a path the router serves', () => {
    expect(SIDEBAR_MENU_ITEMS.map((item) => item.to).sort()).toStrictEqual([...served].sort());
  });
});
