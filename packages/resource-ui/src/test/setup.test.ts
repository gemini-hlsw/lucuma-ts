import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';

const otherIframe = document.createElement('iframe');
document.body.append(otherIframe);
const LEAKED = fakeJwt(standardUser('staff'));
otherIframe.contentWindow?.sessionStorage.setItem('lucuma-refresh-token', JSON.stringify(LEAKED));

const { odbTokenAtom } = await import('@/components/atoms/auth');

describe('sessionStorage per test file', () => {
  it('should start a fresh store signed out although another file left a token in the shared sessionStorage', () => {
    expect(sessionStorage.getItem('lucuma-refresh-token'), 'the per-test clear ran').toBeNull();
    expect(createStore().get(odbTokenAtom)).toBeNull();
  });
});
