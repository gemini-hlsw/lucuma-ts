import { describe, expect, it } from 'vitest';

import { SIDEBAR_NAV_SECTIONS } from './SidebarNavigation';

const items = SIDEBAR_NAV_SECTIONS.flatMap((section) => section.items);

describe('SIDEBAR_NAV_SECTIONS', () => {
  it('ensures every section title is unique', () => {
    const titles = SIDEBAR_NAV_SECTIONS.map((section) => section.title);

    expect(new Set(titles).size).toBe(titles.length);
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

  it('ensures section titles and labels are not empty', () => {
    for (const section of SIDEBAR_NAV_SECTIONS) {
      expect(section.title.trim()).not.toBe('');

      for (const item of section.items) {
        expect(item.label.trim()).not.toBe('');
      }
    }
  });

  it('ensures routes do not end with a trailing slash', () => {
    for (const item of items) {
      expect(item.to).not.toMatch(/\/$/);
    }
  });
});
