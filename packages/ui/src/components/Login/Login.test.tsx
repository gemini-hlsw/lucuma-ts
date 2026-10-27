import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { renderWithContext } from '@/test/render';

import Login from './Login';

const SSO = 'https://sso.example.test';

async function signInState(from?: string): Promise<string | null> {
  await renderWithContext(
    <MemoryRouter
      initialEntries={[{ pathname: '/login', state: from === undefined ? null : { from: { pathname: from } } }]}
    >
      <Login />
    </MemoryRouter>,
    { serverConfig: { ssoUri: SSO } },
  );
  const link = page.getByRole('link').filter({ has: page.getByRole('button', { name: 'Login with ORCID' }) });
  await expect.element(link).toHaveAttribute('href', expect.stringContaining(`${SSO}/auth/v1/stage1`));
  return new URL(link.element().getAttribute('href')!).searchParams.get('state');
}

describe(Login, () => {
  it('returns to the page that sent the user to sign in', async () => {
    expect(await signInState('/telescope')).toBe(`${window.location.origin}/telescope`);
  });

  it('returns to the app root when no page sent the user', async () => {
    expect(await signInState()).toBe(`${window.location.origin}/`);
  });

  it('returns to the app root rather than to another origin', async () => {
    expect(await signInState('//phish.example/steal')).toBe(`${window.location.origin}/`);
  });
});
