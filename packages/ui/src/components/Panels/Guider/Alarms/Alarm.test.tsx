import type { ComponentProps } from 'react';
import type { MockedFunction } from 'vitest';
import type { Locator } from 'vitest/browser';
import { page, userEvent } from 'vitest/browser';
import type { RenderResult } from 'vitest-browser-react';
import { render } from 'vitest-browser-react';

import { createGuideAlarm, createGuideQuality } from '@/test/create';

import { Alarm } from './Alarm';

describe(Alarm, () => {
  let sut: RenderResult;
  let onUpdateAlarm: MockedFunction<ComponentProps<typeof Alarm>['onUpdateAlarm']>;

  const guideQuality = createGuideQuality({
    centroidDetected: true,
    flux: 1000,
  });

  const alarm = createGuideAlarm({
    wfs: 'PWFS1',
  });

  beforeEach(async () => {
    onUpdateAlarm = vi.fn();
    sut = await render(
      <Alarm
        wfs="PWFS1"
        guideQuality={guideQuality}
        alarm={alarm}
        disabled={false}
        alarmState={'GUIDE_COUNTS'}
        onUpdateAlarm={onUpdateAlarm}
      />,
    );
  });

  it('should render', async () => {
    await expect.element(page.getByLabelText('Counts')).toHaveTextContent('1,000');
    await expect.element(page.getByLabelText('Subaperture')).toHaveTextContent('OK');
  });

  it('should show BAD for no centroid', async () => {
    await sut.rerender(
      <Alarm
        wfs="PWFS1"
        guideQuality={{ ...guideQuality, centroidDetected: false }}
        alarm={alarm}
        disabled={false}
        alarmState={undefined}
        onUpdateAlarm={onUpdateAlarm}
      />,
    );
    await expect.element(page.getByLabelText('Subaperture')).toHaveTextContent('BAD');
  });

  it('should call onUpdateAlarm when enabled changes', async () => {
    const checkbox = sut.getByRole('checkbox', { name: 'Enable alarm' });

    await switchEnabled(checkbox);
    expect(onUpdateAlarm).toHaveBeenCalledWith({ wfs: 'PWFS1', enabled: false });
  });

  it('should call onUpdateAlarm when limit changes', async () => {
    const inputNumber = page.getByLabelText('Limit');

    await setLimit(inputNumber, 100);
    expect(onUpdateAlarm).toHaveBeenCalledWith({ wfs: 'PWFS1', limit: 100 });
  });

  it('should not set has-alarm if hasAlarm is false', async () => {
    await sut.rerender(
      <Alarm
        wfs="PWFS1"
        guideQuality={guideQuality}
        alarm={alarm}
        disabled={false}
        alarmState={undefined}
        onUpdateAlarm={onUpdateAlarm}
      />,
    );

    await expect.element(page.getByTestId('no-alarm')).toBeInTheDocument();
  });

  it('should set has-alarm hasAlarm is true', async () => {
    await sut.rerender(
      <Alarm
        wfs="PWFS1"
        guideQuality={{ ...guideQuality, flux: 799 }}
        alarm={alarm}
        disabled={false}
        alarmState={'GUIDE_COUNTS'}
        onUpdateAlarm={onUpdateAlarm}
      />,
    );
    await expect.element(page.getByTestId('has-alarm')).toBeInTheDocument();
  });

  it('should set has-alarm if centroidDetected is false', async () => {
    await sut.rerender(
      <Alarm
        wfs="PWFS1"
        guideQuality={{ ...guideQuality, centroidDetected: false }}
        alarm={alarm}
        disabled={false}
        alarmState={'SUBAPERTURES_BAD'}
        onUpdateAlarm={onUpdateAlarm}
      />,
    );

    await expect.element(page.getByTestId('has-alarm')).toBeInTheDocument();
  });
});

async function setLimit(el: Locator, value: number) {
  await userEvent.fill(el, value.toString());
  await userEvent.tab();
}

async function switchEnabled(el: Locator) {
  await userEvent.click(el);
}
