import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { carrySelection, searchString } from '@/app/carriedSelection';

export function useOpenNight(): (observingNight: string) => void {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const latest = useRef({ navigate, params });
  useEffect(() => {
    latest.current = { navigate, params };
  });

  return useCallback((observingNight: string) => {
    const next = carrySelection(latest.current.params);
    next.set('night', observingNight);
    void latest.current.navigate({ pathname: '/night', search: searchString(next) });
  }, []);
}
