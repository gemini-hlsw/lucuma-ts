import '@/styles/global.css';
import '@/styles/main.css';

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

import type * as EnvironmentModule from '@/app/environment';
import { liveGraphqlEndpoint } from '@/app/environment';
import { expectCopyButtonBesideLastToken, expectVersionOnOneLine, openDialog, value } from '@/test/aboutDialog';

import { AboutResource } from './AboutResource';

vi.mock('@/app/environment', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvironmentModule>();
  const staging = actual.environmentFor('resource-staging.lucuma.xyz');
  return { ...actual, CURRENT_ENV: staging, liveGraphqlEndpoint: staging.graphqlEndpoint };
});

const DEPLOYED_VERSION = 'main+20260921.abc1234-STAGING';

function setVersion(row: HTMLElement, version: string): void {
  const suffix = version.slice(version.lastIndexOf('-'));
  row.querySelector('span')!.firstChild!.textContent = version.slice(0, -suffix.length);
  row.querySelector('span span')!.firstChild!.textContent = suffix;
}

describe(AboutResource, () => {
  beforeAll(() => {
    document.documentElement.classList.add('dark');
  });

  it('wraps the deployed endpoint inside the panel at phone width, holding the copy button on the version row', async () => {
    const dialog = await openDialog(390, 844);

    await expect.element(page.getByText(liveGraphqlEndpoint)).toBeVisible();
    const content = dialog.querySelector<HTMLElement>('.p-dialog-content')!;
    expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);

    const button = dialog.querySelector('button[aria-label="Copy version"]');
    expect(value(dialog, 'Version').contains(button)).toBe(true);
  });

  it.each([
    [640, 800],
    [1024, 768],
  ])('holds a deployed -STAGING version string on one line at %ix%i', async (width, height) => {
    const dialog = await openDialog(width, height);

    const row = value(dialog, 'Version');
    expect(row.textContent).toMatch(/-STAGING$/);
    setVersion(row, DEPLOYED_VERSION);

    expectVersionOnOneLine(row);
  });

  it.each([
    [320, 568],
    [390, 844],
  ])('keeps the copy button beside the version last token at %ix%i', async (width, height) => {
    const dialog = await openDialog(width, height);

    const row = value(dialog, 'Version');
    setVersion(row, DEPLOYED_VERSION);

    expectCopyButtonBesideLastToken(row);
  });
});
