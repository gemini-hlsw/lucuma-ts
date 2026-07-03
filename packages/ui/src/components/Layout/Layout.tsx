import './Layout.css';

import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { SolarProgress } from '../SolarProgress';
import { useAcquisitionAdjustmentToast } from './AcquisitionAdjustmentToast';
import { useAlarmAudio } from './AlarmAudio';
import Navbar from './Navbar/Navbar';

export default function Layout() {
  useAlarmAudio();
  useAcquisitionAdjustmentToast();
  return (
    <div className="layout">
      <Navbar />
      <div className="body">
        <Suspense fallback={<SolarProgress />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
