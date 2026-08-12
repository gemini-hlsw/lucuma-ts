/**
 * Every way into a night lands on the same URL.
 *
 * The calendar square, the week's facts card and a chart bar all navigate to
 * `/night` through this one hook, which keeps every other URL parameter - site,
 * semester - so the selection survives the jump.
 */
import { useNavigate, useSearchParams } from 'react-router';

export function useOpenNight(): (observingNight: string) => void {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  return (observingNight: string) => {
    const next = new URLSearchParams(params);
    next.set('night', observingNight);
    void navigate({ pathname: '/night', search: `?${next.toString()}` });
  };
}
