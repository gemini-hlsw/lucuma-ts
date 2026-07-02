import { useCallback, useEffect, useRef, useState } from 'react';

export function useLongPress(
  onLongPress: React.EventHandler<React.MouseEvent | React.TouchEvent>,
  onClick: React.EventHandler<React.MouseEvent | React.TouchEvent>,
  { shouldPreventDefault = true, delay = 300 } = {},
) {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeout = useRef<NodeJS.Timeout>(null);
  const target = useRef<EventTarget>(null);
  const isTouch = useRef(false);

  const start = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (event.type === 'mousedown' && isTouch.current) return;
      if (event.type === 'touchstart') isTouch.current = true;

      if (shouldPreventDefault && event.target) {
        event.target.addEventListener('touchend', preventDefault, {
          passive: false,
        });
        target.current = event.target;
      }
      timeout.current = setTimeout(() => {
        onLongPress(event);
        setLongPressTriggered(true);
      }, delay);
    },
    [onLongPress, delay, shouldPreventDefault],
  );

  const clear = useCallback(
    (event: React.MouseEvent | React.TouchEvent, shouldTriggerClick = true) => {
      if (event.type === 'mouseup' && isTouch.current) {
        isTouch.current = false;
        return;
      }

      if (timeout.current) clearTimeout(timeout.current);
      if (shouldTriggerClick && !longPressTriggered) onClick(event);
      setLongPressTriggered(false);
      if (shouldPreventDefault && target.current) {
        target.current.removeEventListener('touchend', preventDefault);
        target.current = null;
      }
    },
    [shouldPreventDefault, onClick, longPressTriggered],
  );

  // Cleanup
  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
      if (target.current) {
        target.current.removeEventListener('touchend', preventDefault);
        target.current = null;
      }
    },
    [],
  );

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchEnd: (e: React.TouchEvent) => clear(e),
    onTouchCancel: (e: React.TouchEvent) => clear(e, false),
  };
}

const isTouchEvent = (event: Event): event is TouchEvent => 'touches' in event;

const preventDefault = (event: Event) => {
  if (!isTouchEvent(event)) return;
  if (event.touches.length < 2 && event.preventDefault) {
    event.preventDefault();
  }
};
