import type { AxisLabelsFormatterContextObject, Options, XAxisOptions, YAxisOptions } from 'highcharts';

export function singleXAxis({ xAxis }: Options): XAxisOptions {
  if (xAxis === undefined) throw new Error('expected a single x axis, found none');
  if (Array.isArray(xAxis)) {
    if (xAxis.length !== 1) throw new Error(`expected a single x axis, found ${String(xAxis.length)}`);
    return xAxis[0]!;
  }
  return xAxis;
}

/** What the axis prints for one tick, called the way Highcharts calls it: the tick as `this`. */
export function axisLabel(axis: XAxisOptions | YAxisOptions, ctx: { value: number | string; pos?: number }): string {
  const formatter = axis.labels?.formatter;
  if (formatter === undefined) throw new Error('the axis has no label formatter');
  return formatter.call(ctx as AxisLabelsFormatterContextObject, {} as never);
}
