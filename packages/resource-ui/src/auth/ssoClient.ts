import * as sso from '@gemini-hlsw/lucuma-common-ui/sso';

import { CURRENT_ENV } from '@/app/environment';

export const signInUrl = (returnTo: string = window.location.href): string =>
  sso.signInUrl(CURRENT_ENV.ssoUri, returnTo);
