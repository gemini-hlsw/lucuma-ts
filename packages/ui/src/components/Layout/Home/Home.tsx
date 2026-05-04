import './Home.css';

import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { Guider } from '@Guider/Guider';
import { Telescope } from '@Telescope/Telescope';
import { WavefrontSensors } from '@WavefrontSensors/WavefrontSensors';
import { useState } from 'react';

import type { PanelType } from '@/types';

export default function Home() {
  const TOUCH_THRESHOLD = 50;
  const [panelDisplay, setPanelDisplay] = useState<PanelType>('telescope');
  const [touchPos, setTouchPos] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchPos(e.touches[0]!.pageX);
  };

  const nextPanel = () => {
    switch (panelDisplay) {
      case 'telescope':
        setPanelDisplay('wavefront-sensors');
        break;
      case 'wavefront-sensors':
        setPanelDisplay('guider');
        break;
      case 'guider':
        setPanelDisplay('telescope');
        break;
      default:
        break;
    }
  };

  const prevPanel = () => {
    switch (panelDisplay) {
      case 'telescope':
        setPanelDisplay('guider');
        break;
      case 'wavefront-sensors':
        setPanelDisplay('telescope');
        break;
      case 'guider':
        setPanelDisplay('wavefront-sensors');
        break;
      default:
        break;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const movement = e.changedTouches[0]!.pageX - touchPos;
    if (movement > TOUCH_THRESHOLD) {
      prevPanel();
    } else if (movement < -TOUCH_THRESHOLD) {
      nextPanel();
    }
  };

  return (
    <div className={cn('main-body', panelDisplay)} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="panel telescope">
        <Telescope prevPanel={prevPanel} nextPanel={nextPanel} />
      </div>
      <div className="panel wavefront-sensors">
        <WavefrontSensors prevPanel={prevPanel} nextPanel={nextPanel} />
      </div>
      <div className="panel guider">
        <Guider prevPanel={prevPanel} nextPanel={nextPanel} />
      </div>
    </div>
  );
}
