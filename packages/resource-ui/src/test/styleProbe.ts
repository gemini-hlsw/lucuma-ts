/** The root the app inherits, since it sets none of its own and every rem is measured against it. */
export const ROOT_FONT_SIZE = '16px';

export type Rgb = [number, number, number];

/** The pixel a colour paints over a backdrop, composited by the browser: `color-mix` computes as oklab. */
export function pixelOver(color: string, backdrop: string): Rgb {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d')!;
  for (const layer of [backdrop, color]) {
    context.fillStyle = layer;
    context.fillRect(0, 0, 1, 1);
  }
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r!, g!, b!];
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const luminance = (rgb: Rgb) =>
    rgb
      .map((c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4))
      .reduce((sum, channel, index) => sum + [0.2126, 0.7152, 0.0722][index]! * channel, 0);
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/** What the browser makes of a size token, since a token may be an expression rather than a number. */
export function resolvedSize(token: string): string {
  const probe = document.createElement('span');
  probe.style.fontSize = `var(${token})`;
  document.body.appendChild(probe);
  const size = getComputedStyle(probe).fontSize;
  probe.remove();
  return size;
}
