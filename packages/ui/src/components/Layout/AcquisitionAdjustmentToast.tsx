import offsetsReceivedMp3 from '@assets/sounds/offsets-received.mp3';
import offsetsReceivedWebm from '@assets/sounds/offsets-received.webm';
import { useToast } from '@gemini-hlsw/lucuma-common-ui';
import { useAcquisitionAdjustmentState } from '@gql/server/AcquisitionAdjustment';
import type { ToastMessage } from 'primereact/toast';
import { useEffect } from 'react';

import { useAudio } from '@/Helpers/hooks';

import { AcquisitionAdjustmentPrompt } from './AcquisitionAdjustmentPrompt';

export function useAcquisitionAdjustmentToast() {
  const toast = useToast();

  const { data } = useAcquisitionAdjustmentState();

  const alarmAudio = useAudio(offsetsReceivedMp3, offsetsReceivedWebm);

  useEffect(() => {
    if (data?.acquisitionAdjustmentState.command === 'ASK_USER') {
      const acquisitionAdjustmentToast: ToastMessage = {
        id: `acquisition-adjustment`,
        severity: 'info',
        summary: `Apply GACQ offsets?`,
        closable: false,
        detail: <AcquisitionAdjustmentPrompt state={data.acquisitionAdjustmentState} />,
        sticky: true,
      };
      toast?.show(acquisitionAdjustmentToast);
      void alarmAudio?.play();

      return () => {
        toast?.remove(acquisitionAdjustmentToast);
      };
    }
    return;
  }, [data, toast, alarmAudio]);
}
