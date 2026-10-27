import { ToastOutlet as SharedToastOutlet } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';

/** Shared toast outlet, placed as Resource's stylesheet expects. */
export function ToastOutlet(): JSX.Element {
  // PrimeReact's inline style pins the corner 20px in; its stylesheet sizes the toast as 100% less --toast-indent.
  return <SharedToastOutlet position="bottom-right" className="[--toast-indent:40px]" />;
}
