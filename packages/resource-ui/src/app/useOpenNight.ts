/**
 * Every way into a night lands on the same URL.
 *
 * The calendar square, the week's facts card and a chart bar all navigate to
 * `/night` through this one hook, which keeps every other URL parameter - site,
 * semester, clock - so the selection survives the jump.
 *
 * The returned function is one stable identity, reading the current location
 * through a ref at call time. It is embedded in chart options, and a fresh
 * identity per URL change meant a Highcharts `update()` on every masthead
 * clock toggle - which the heatmap answers by garbling its cells (Highcharts
 * 12). A chart's options must only change when what it draws changes.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export function useOpenNight(): (observingNight: string) => void {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const latest = useRef({ navigate, params });
  useEffect(() => {
    latest.current = { navigate, params };
  });

  return useCallback((observingNight: string) => {
    const next = new URLSearchParams(latest.current.params);
    next.set('night', observingNight);
    void latest.current.navigate({ pathname: '/night', search: `?${next.toString()}` });
  }, []);
}
