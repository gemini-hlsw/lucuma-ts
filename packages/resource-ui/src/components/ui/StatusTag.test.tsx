/*
 * The tag ink rule (shell.css: `.dark .p-tag.p-tag-success, .dark .p-tag.p-tag-danger { color:
 * var(--color-canvas) }`) is a stylesheet fact, so this file loads it - one of the exceptions
 * CLAUDE.md names, for the same reason as Layout.test.tsx: the ink swap is the stylesheet's to
 * decide, not this component's.
 */
import '@/styles/global.css';
import '@/styles/main.css';

import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { contrastRatio, pixelOver } from '@/test/styleProbe';

import { StatusTag } from './StatusTag';

describe(StatusTag, () => {
  it.each([
    ['success', 'Science', 'normal'],
    ['danger', 'Unavailable', 'alert'],
  ] as const)('clears 4.5:1 for a %s tag against its own fill under the dark theme', async (severity, label, tone) => {
    const screen = await render(
      <div className="dark">
        <StatusTag status={{ label, severity, tone }} />
      </div>,
    );

    const tag = screen.container.querySelector<HTMLElement>('.p-tag')!;
    const style = getComputedStyle(tag);
    const fill = pixelOver(style.backgroundColor, getComputedStyle(document.body).backgroundColor);
    const ink = pixelOver(style.color, `rgb(${fill[0]} ${fill[1]} ${fill[2]})`);

    expect(contrastRatio(ink, fill)).toBeGreaterThanOrEqual(4.5);
  });
});
