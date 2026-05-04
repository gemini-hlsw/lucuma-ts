import { cn, isNotNullish, round } from '@gemini-hlsw/lucuma-common-ui';
import { useRef } from 'react';

import { useCanEdit } from '@/components/atoms/auth';
import { useSetTargetEdit } from '@/components/atoms/target';
import { useLongPress } from '@/Helpers/longPress';
import type { TargetType, TypeOfTarget } from '@/types';

export function Target({
  target,
  updateSelectedTarget,
  selectedTarget,
  disabled,
}: {
  target: TargetType;
  updateSelectedTarget: (target: number) => void | Promise<void>;
  selectedTarget?: number | null;
  disabled?: boolean;
}) {
  const canEdit = useCanEdit();
  const setTargetEdit = useSetTargetEdit();
  const clickRef = useRef<NodeJS.Timeout>(null);

  function onLongPress() {
    if (clickRef.current) clearTimeout(clickRef.current);
    setTargetEdit({
      isVisible: true,
      target: target,
    });
  }

  const longPressEvent = useLongPress(onLongPress, targetClicked, {
    shouldPreventDefault: true,
    delay: 250,
  });

  function targetClicked(e: React.MouseEvent | React.TouchEvent) {
    if (!canEdit || disabled) return;
    switch (e.detail) {
      case 1:
        if (selectedTarget === target.pk) return;
        clickRef.current = setTimeout(() => {
          void updateSelectedTarget(target.pk);
        }, 300);
        break;
      case 2:
        if (clickRef.current) clearTimeout(clickRef.current);
        setTargetEdit({
          isVisible: true,
          target: target,
        });
        break;
      default:
        break;
    }
  }

  const classNames = cn(disabled && 'p-disabled', selectedTarget === target.pk && 'selected-target');

  if (target.type === 'FIXED') {
    return (
      <li className={classNames} key="science-target" {...longPressEvent}>
        <div className="target-item-fixed">
          <span className="target-name" title={target.name ?? undefined}>
            {target.name}
          </span>
          <span>{targetTypeLabel(target.type)}</span>
          <span className="text-right">{target.sidereal?.az?.dms} Az</span>
          <span className="text-right">{target.sidereal?.el?.dms} El</span>
        </div>
      </li>
    );
  } else {
    return (
      <li className={classNames} key="science-target" {...longPressEvent}>
        <div className="target-item">
          <span className="target-name" title={target.name ?? undefined}>
            {target.name}
          </span>
          <span>{targetTypeLabel(target.type)}</span>
          <span className="text-right">{target.sidereal?.ra?.hms}&nbsp;RA</span>
          <span className="text-right">{target.sidereal?.dec?.dms}&nbsp;Dec</span>
          <span className="text-right">
            {target.band}&nbsp;{isNotNullish(target.magnitude) && round(target.magnitude, 2)}
          </span>
        </div>
      </li>
    );
  }
}

function targetTypeLabel(type: TypeOfTarget) {
  switch (type) {
    case 'BLINDOFFSET':
      return 'Blind Offset';

    case 'FIXED':
      return 'Fixed';

    case 'OIWFS':
      return 'OIWFS';

    case 'PWFS1':
      return 'PWFS1';

    case 'PWFS2':
      return 'PWFS2';
    case 'SCIENCE':
      return 'Science';
    default:
      return type;
  }
}
