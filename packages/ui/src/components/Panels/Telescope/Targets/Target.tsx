import { cn, isNotNullish, round } from '@gemini-hlsw/lucuma-common-ui';
import type { TargetType } from '@gql/configs/gen/graphql';
import { useRef } from 'react';

import { useCanEdit } from '@/components/atoms/auth';
import { useSetTargetEdit } from '@/components/atoms/target';
import { useLongPress } from '@/Helpers/longPress';
import type { Target } from '@/types';

export function Target({
  target,
  updateSelectedTarget,
  selectedTarget,
  disabled,
}: {
  target: Target;
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
    // Touch events don't populate `detail` (it's a mouse click-count), so a tap
    // reports 0. Treat a tap as a single click/select; long-press handles edit.
    const clickCount = e.type === 'touchend' ? 1 : e.detail;
    switch (clickCount) {
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
          {target.sidereal?.az?.dms && <span className="text-right">Az&nbsp;{target.sidereal?.az?.dms}</span>}
          {target.sidereal?.el?.dms && <span className="text-right">El&nbsp;{target.sidereal?.el?.dms}</span>}
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
          {target.sidereal?.ra?.hms && <span className="text-right">RA&nbsp;{target.sidereal?.ra?.hms}</span>}
          {target.sidereal?.dec?.dms && <span className="text-right">Dec&nbsp;{target.sidereal?.dec?.dms}</span>}
          <span className="text-right">
            {target.band}&nbsp;{isNotNullish(target.magnitude) && round(target.magnitude, 2)}
          </span>
        </div>
      </li>
    );
  }
}

function targetTypeLabel(type: TargetType) {
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
