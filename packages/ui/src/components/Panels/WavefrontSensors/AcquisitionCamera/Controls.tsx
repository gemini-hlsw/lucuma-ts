import { formatToSignedArcseconds, isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import { useConfiguration } from '@gql/configs/Configuration';
import type { WfsType } from '@gql/configs/gen/graphql';
import { Button } from 'primereact/button';
import { Divider } from 'primereact/divider';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputSwitch } from 'primereact/inputswitch';
import { Slider } from 'primereact/slider';
import type React from 'react';
import { startTransition, useId, useState } from 'react';

import { CaretDown, CaretLeft, CaretRight, CaretUp } from '@/components/Icons';
import { instrumentToOiwfs } from '@/Helpers/functions';

import type { Coords, HandsetStrategy } from './strategy';
import { strategies, wfsStrategy } from './strategy';

type CoordOnChange = (value: Coords) => void;

const alignmentOptions = [
  { value: 'Az/El', show: () => true },
  { value: 'AC', show: () => true },
  { value: 'Instrument', show: () => true },
  { value: 'RA/Dec', show: () => true },
  { value: 'PWFS1', show: (wfs?: WfsType) => wfs === 'PWFS1' },
  { value: 'PWFS2', show: (wfs?: WfsType) => wfs === 'PWFS2' },
  { value: 'OIWFS', show: (wfs?: WfsType) => wfs === 'OIWFS' },
] as const;
export type Alignment = (typeof alignmentOptions)[number]['value'];

export function AlignmentSelector({
  onChange,
  defaultAlignment,
  loading,
  canEdit,
  instrumentWfs,
}: {
  onChange: (strategy: HandsetStrategy) => void;
  defaultAlignment: Alignment;
  loading: boolean;
  canEdit: boolean;
  instrumentWfs: WfsType | undefined;
}) {
  const id = useId();
  // Local State
  const [alignment, setAlignment] = useState<Alignment>(defaultAlignment);

  // Instrument being used
  const { data: configData, loading: configLoading } = useConfiguration();
  const instrument = configData?.configuration?.obsInstrument;

  const updateAlignment = (alignment: Alignment) =>
    startTransition(() => {
      setAlignment(alignment);
      if (alignment === 'OIWFS') {
        onChange(wfsStrategy(instrumentToOiwfs(instrument)!));
      } else {
        onChange(strategies[alignment]);
      }
    });

  return (
    <>
      <label htmlFor={`coord-system-${id}`}>Alignment</label>
      <Dropdown
        inputId={`coord-system-${id}`}
        disabled={loading || !canEdit || configLoading}
        value={alignment}
        options={alignmentOptions.filter((a) => a.show(instrumentWfs)).map((cs) => cs.value)}
        onChange={(e) => updateAlignment(e.value as Alignment)}
        placeholder="Select alignment"
      />
    </>
  );
}

const steps = Object.freeze([0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 60]);
const nSteps = steps.length;

function CoordinatesInput({
  onChange,
  strategy,
  loading,
  canEdit,
}: {
  onChange: CoordOnChange;
  strategy: HandsetStrategy;
  loading: boolean;
  canEdit: boolean;
}) {
  const id = useId();
  const { up, down, right, left } = strategy;

  // Start at 0.5
  const [sliderStep, setSliderStep] = useState(2);
  const [offset, setOffset] = useState(steps[sliderStep]!);

  return (
    <div className="coordinates-input">
      <div className="coordinates-buttons">
        <Button
          tooltip={up.label}
          aria-label={up.label}
          data-testid="UP"
          style={{ gridArea: 'gu' }}
          onClick={() => onChange(up.mod(offset))}
          className="coordinate-up"
          icon={<CaretUp />}
          disabled={loading || !canEdit}
        />
        <Button
          tooltip={left.label}
          aria-label={left.label}
          data-testid="LEFT"
          style={{ gridArea: 'gl' }}
          onClick={() => onChange(left.mod(offset))}
          className="coordinate-left"
          icon={<CaretLeft />}
          disabled={loading || !canEdit}
        />
        <Button
          tooltip={right.label}
          aria-label={right.label}
          data-testid="RIGHT"
          style={{ gridArea: 'gr' }}
          onClick={() => onChange(right.mod(offset))}
          className="coordinate-right"
          icon={<CaretRight />}
          disabled={loading || !canEdit}
        />
        <Button
          tooltip={down.label}
          aria-label={down.label}
          data-testid="DOWN"
          style={{ gridArea: 'gd' }}
          onClick={() => onChange(down.mod(offset))}
          className="coordinate-down"
          icon={<CaretDown />}
          disabled={loading || !canEdit}
        />
      </div>
      <div className="coordinates-stepsize">
        <div className="control-row">
          <label htmlFor={`step-stepsize-${id}`}>Step</label>
          <InputNumber
            disabled={loading || !canEdit}
            inputId={`step-stepsize-${id}`}
            min={0}
            maxFractionDigits={1}
            value={offset}
            onValueChange={(e) => setOffset(e.value!)}
          />
        </div>

        <Slider
          disabled={loading || !canEdit}
          min={0}
          max={nSteps - 1}
          step={1}
          value={sliderStep}
          onChange={(e) => {
            const value = e.value as number;
            setSliderStep(value);
            setOffset(steps[value]!);
          }}
        />
      </div>
    </div>
  );
}
function ManualInput({
  onChange,
  strategy,
  loading,
  canEdit,
}: {
  onChange: CoordOnChange;
  strategy: HandsetStrategy;
  loading: boolean;
  canEdit: boolean;
}) {
  const id = useId();
  const [auxCoords, setAuxCoords] = useState({
    horizontal: 0,
    vertical: 0,
  });

  return (
    <div className="manual-input">
      <label htmlFor={`manual-input-horizontal-${id}`}>{strategy.horizontal}</label>
      <InputNumber
        inputId={`manual-input-horizontal-${id}`}
        disabled={loading || !canEdit}
        value={auxCoords.horizontal}
        maxFractionDigits={2}
        onValueChange={(e) => setAuxCoords((prev) => ({ ...prev, horizontal: e.value! }))}
      />
      <label htmlFor={`manual-input-vertical-${id}`}>{strategy.vertical}</label>
      <InputNumber
        inputId={`manual-input-vertical-${id}`}
        disabled={loading || !canEdit}
        value={auxCoords.vertical}
        maxFractionDigits={2}
        onValueChange={(e) => setAuxCoords((prev) => ({ ...prev, vertical: e.value! }))}
      />

      <Button
        size="small"
        label="Apply"
        className="apply-button"
        onClick={() => {
          onChange(auxCoords);
          setAuxCoords({ horizontal: 0, vertical: 0 }); // Reset after applying
        }}
        disabled={loading || !canEdit}
      />
    </div>
  );
}

export function CorrectionTable({
  localHorizontal,
  localVertical,
  guideHorizontal,
  guideVertical,
  localReset,
  guideReset,
  guideAbsorb,
}: {
  localHorizontal: number | string | undefined;
  localVertical: number | string | undefined;
  guideHorizontal: number | string | undefined;
  guideVertical: number | string | undefined;
  localReset: React.ReactNode;
  guideReset: React.ReactNode;
  guideAbsorb: React.ReactNode;
}) {
  return (
    <div className="correction-table">
      <table>
        <tbody>
          <tr>
            <td></td>
            <td className="center-cell">Az</td>
            <td className="center-cell">El</td>
            <td></td>
          </tr>
          <tr>
            <td>Local</td>
            <td className="center-cell">{formatToSignedArcseconds(localHorizontal, '')}</td>
            <td className="center-cell">{formatToSignedArcseconds(localVertical, '')}</td>
            <td>{localReset}</td>
          </tr>
          <tr>
            <td>Guide</td>
            <td className="center-cell">{formatToSignedArcseconds(guideHorizontal, '')}</td>
            <td className="center-cell">{formatToSignedArcseconds(guideVertical, '')}</td>
            <td>{guideReset}</td>
          </tr>
        </tbody>
      </table>
      {guideAbsorb}
    </div>
  );
}

export function CurrentCoordinates({
  horizontal,
  vertical,
  horizontalLabel,
  verticalLabel,
  currentLabel,
}: {
  horizontal: number | string | undefined;
  vertical: number | string | undefined;
  horizontalLabel: string;
  verticalLabel: string;
  currentLabel?: string;
}) {
  const current = currentLabel ?? 'Current offset:';
  return (
    <div className="control-row">
      <b>{current}</b> {horizontalLabel} {formatToSignedArcseconds(horizontal, '')} {verticalLabel}{' '}
      {formatToSignedArcseconds(vertical, '')}
    </div>
  );
}

export function InputControls({
  loading,
  handleApply,
  strategy,
  canEdit,
}: {
  loading: boolean;
  handleApply: (coords: Coords) => void;
  strategy: HandsetStrategy;
  canEdit: boolean;
}) {
  return (
    <div className="control-row coordinates-input-row">
      <CoordinatesInput loading={loading} onChange={handleApply} strategy={strategy} canEdit={canEdit} />
      <Divider className="input-divider" layout="vertical" />
      <ManualInput loading={loading} onChange={handleApply} strategy={strategy} canEdit={canEdit} />
    </div>
  );
}

export function OpenLoopsInput({
  openLoops,
  onChange,
  loading,
  canEdit,
}: {
  openLoops: boolean;
  onChange: (value: boolean) => void;
  loading: boolean;
  canEdit: boolean;
}) {
  const id = useId();
  return (
    <div className="control-row open-loops">
      <label htmlFor={`open-loops-${id}`}>Open loops while offsetting</label>
      <InputSwitch
        disabled={loading || !canEdit}
        inputId={`open-loops-${id}`}
        checked={openLoops}
        onChange={(e) => onChange(e.value)}
      />
    </div>
  );
}

export function Autoadjust() {
  return (
    <div className="control-row under-construction">
      <Button label="Autoadjust" />
    </div>
  );
}

export function AlignAngleInput({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value: number | null;
  onChange: (value: number | null | undefined) => void;
}) {
  const id = useId();
  return (
    <>
      <label htmlFor={`alignment-angle-${id}`}>Align Angle</label>
      <InputNumber
        inputId={`alignment-angle-${id}`}
        suffix="°"
        disabled={disabled}
        value={value}
        onValueChange={(e) => (isNotNullish(e.value) ? onChange(e.value) : undefined)}
      />
    </>
  );
}
