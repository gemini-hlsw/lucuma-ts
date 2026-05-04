import { cn, isNotNullish, when } from '@gemini-hlsw/lucuma-common-ui';
import { useCalParams, useCalParamsHistory, useCreateCalParams } from '@gql/configs/CalParams';
import type { CalParamsCreateInput } from '@gql/configs/gen/graphql';
import { CommentConfirmButton } from '@Shared/CommentConfirmButton';
import { Button } from 'primereact/button';
import { InputNumber, type InputNumberProps } from 'primereact/inputnumber';
import { Tooltip } from 'primereact/tooltip';
import { startTransition, useEffect, useId, useState } from 'react';

import { useCanEdit } from '@/components/atoms/auth';
import { useSetCalParamsHistoryVisible } from '@/components/atoms/calparams';
import { useServerConfigValue } from '@/components/atoms/config';
import { ClockRotateLeft, FloppyDisk, TriangleExclamation } from '@/components/Icons';

/**
 * Format numbers with at least 2 fraction digits.
 */
const numFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2 });

export function CalParamsContent() {
  const { site } = useServerConfigValue();
  const setCalParamsHistoryVisible = useSetCalParamsHistoryVisible();

  const { data: calParamsData, loading: calParamsLoading } = useCalParams(site);
  const calParams = calParamsData?.calParams;

  const canEdit = useCanEdit();

  const [createCalparams, { loading: createCalparamsLoading }] = useCreateCalParams();
  useCalParamsHistory(site);

  const loading = createCalparamsLoading || calParamsLoading;

  const [auxCalParams, setAuxCalParams] = useState<Omit<
    CalParamsCreateInput,
    'site' | 'defocusEnabled' | 'comment' | 'createdAt' | '__typename'
  > | null>(null);

  useEffect(() => {
    if (calParams) {
      startTransition(() =>
        setAuxCalParams({
          acqCamX: calParams.acqCamX,
          acqCamY: calParams.acqCamY,
          baffleVisible: calParams.baffleVisible,
          baffleNearIR: calParams.baffleNearIR,
          topShutterCurrentLimit: calParams.topShutterCurrentLimit,
          bottomShutterCurrentLimit: calParams.bottomShutterCurrentLimit,
          pwfs1CenterX: calParams.pwfs1CenterX,
          pwfs1CenterY: calParams.pwfs1CenterY,
          pwfs1CenterZ: calParams.pwfs1CenterZ,
          pwfs2CenterX: calParams.pwfs2CenterX,
          pwfs2CenterY: calParams.pwfs2CenterY,
          pwfs2CenterZ: calParams.pwfs2CenterZ,
          gmosSfoDefocus: calParams.gmosSfoDefocus,
          gnirsSfoDefocus: calParams.gnirsSfoDefocus,
          gmosP1Defocus: calParams.gmosP1Defocus,
          gmosOiDefocus: calParams.gmosOiDefocus,
          gnirsP1Defocus: calParams.gnirsP1Defocus,
        }),
      );
    }
  }, [calParams]);

  const changedValues = (Object.entries(auxCalParams ?? {}) as [keyof NonNullable<typeof auxCalParams>, number][])
    .filter(([key, value]) => value !== calParams?.[key] && isNotNullish(calParams))
    .map(([key, value]) => ({
      key,
      value: numFormat.format(value),
      original: numFormat.format(calParams![key]!),
    }));
  const changedKeys = new Set(changedValues.map(({ key }) => key));

  const maxChangedKeyLength = Math.max(...[...changedValues].map(({ key }) => key.length)) ?? 0;
  const maxChangedOriginalLength = Math.max(...[...changedValues].map(({ original }) => original.length)) ?? 0;
  // Format to `  key: value ➡️ original`
  const initialComment = `Changed parameters: \n${[...changedValues]
    .map(
      ({ key, value, original }) =>
        `  ${(key + ':').padEnd(maxChangedKeyLength + 1, ' ')} ${original.padEnd(maxChangedOriginalLength, ' ')} ➡️ ${value}`,
    )
    .join('\n')}`;

  const updateCalParam = (key: keyof CalParamsCreateInput, value: number) =>
    setAuxCalParams((prev) => ({
      ...(prev as CalParamsCreateInput),
      [key]: value,
    }));

  const revertButton = (
    <Button
      severity="secondary"
      icon={<ClockRotateLeft />}
      tooltip="Revert to previous configuration"
      disabled={loading || !canEdit}
      onClick={() => setCalParamsHistoryVisible(true)}
    />
  );

  const saveButton = (
    <CommentConfirmButton
      className="cal-params-save-button"
      loading={loading}
      disabled={!canEdit || changedKeys.size === 0}
      tooltip="Save params"
      message="Save parameters?"
      icon={<FloppyDisk />}
      commentLabel="Comments:"
      initialComment={initialComment}
      onConfirm={async (comment) => {
        if (!auxCalParams || !calParams) return;
        await createCalparams({
          variables: {
            input: {
              ...auxCalParams,
              defocusEnabled: calParams.defocusEnabled,
              site,
              comment,
            },
          },
        });
      }}
    />
  );

  return (
    <>
      <div className="cal-params-header-buttons">
        {revertButton}
        {saveButton}
      </div>

      <div className="cal-params-content">
        <CalParamInputGroup title="Acquisition camera">
          <CalParamInput
            label="X"
            value={auxCalParams?.acqCamX}
            onChange={(value) => updateCalParam('acqCamX', value)}
            loading={loading}
            filled={changedKeys.has('acqCamX')}
            suffix=" px"
            minFractionDigits={0}
            maxFractionDigits={0}
          />
          <CalParamInput
            label="Y"
            value={auxCalParams?.acqCamY}
            onChange={(value) => updateCalParam('acqCamY', value)}
            loading={loading}
            filled={changedKeys.has('acqCamY')}
            suffix=" px"
            minFractionDigits={0}
            maxFractionDigits={0}
          />
        </CalParamInputGroup>

        <CalParamInputGroup title="Baffle wavelength limit">
          <CalParamInput
            label="Visible"
            value={auxCalParams?.baffleVisible}
            onChange={(value) => updateCalParam('baffleVisible', value)}
            loading={loading}
            filled={changedKeys.has('baffleVisible')}
            suffix=" μm"
          />
          <CalParamInput
            label="Near IR"
            value={auxCalParams?.baffleNearIR}
            onChange={(value) => updateCalParam('baffleNearIR', value)}
            loading={loading}
            filled={changedKeys.has('baffleNearIR')}
            suffix=" μm"
          />
        </CalParamInputGroup>

        <CalParamInputGroup title="Shutter current limits" underConstruction>
          <CalParamInput
            label="Top"
            value={auxCalParams?.topShutterCurrentLimit}
            onChange={(value) => updateCalParam('topShutterCurrentLimit', value)}
            loading={loading}
            filled={changedKeys.has('topShutterCurrentLimit')}
            suffix=" A"
          />
          <CalParamInput
            label="Bottom"
            value={auxCalParams?.bottomShutterCurrentLimit}
            onChange={(value) => updateCalParam('bottomShutterCurrentLimit', value)}
            loading={loading}
            filled={changedKeys.has('bottomShutterCurrentLimit')}
            suffix=" A"
          />
        </CalParamInputGroup>

        <CalParamInputGroup title="PWFS1 center" underConstruction>
          <CalParamInput
            label="X"
            value={auxCalParams?.pwfs1CenterX}
            onChange={(value) => updateCalParam('pwfs1CenterX', value)}
            loading={loading}
            filled={changedKeys.has('pwfs1CenterX')}
            suffix=" mm"
          />
          <CalParamInput
            label="Y"
            value={auxCalParams?.pwfs1CenterY}
            onChange={(value) => updateCalParam('pwfs1CenterY', value)}
            loading={loading}
            filled={changedKeys.has('pwfs1CenterY')}
            suffix=" mm"
          />
          <CalParamInput
            label="Z"
            value={auxCalParams?.pwfs1CenterZ}
            onChange={(value) => updateCalParam('pwfs1CenterZ', value)}
            loading={loading}
            filled={changedKeys.has('pwfs1CenterZ')}
            suffix=" mm"
          />
        </CalParamInputGroup>

        <CalParamInputGroup title="PWFS2 center" underConstruction>
          <CalParamInput
            label="X"
            value={auxCalParams?.pwfs2CenterX}
            onChange={(value) => updateCalParam('pwfs2CenterX', value)}
            loading={loading}
            filled={changedKeys.has('pwfs2CenterX')}
            suffix=" mm"
          />
          <CalParamInput
            label="Y"
            value={auxCalParams?.pwfs2CenterY}
            onChange={(value) => updateCalParam('pwfs2CenterY', value)}
            loading={loading}
            filled={changedKeys.has('pwfs2CenterY')}
            suffix=" mm"
          />
          <CalParamInput
            label="Z"
            value={auxCalParams?.pwfs2CenterZ}
            onChange={(value) => updateCalParam('pwfs2CenterZ', value)}
            loading={loading}
            filled={changedKeys.has('pwfs2CenterZ')}
            suffix=" mm"
          />
        </CalParamInputGroup>

        {calParams?.defocusEnabled && (
          <>
            <CalParamInputGroup title="SFO defocus" underConstruction>
              <CalParamInput
                label="GMOS"
                value={auxCalParams?.gmosSfoDefocus}
                onChange={(value) => updateCalParam('gmosSfoDefocus', value)}
                loading={loading}
                filled={changedKeys.has('gmosSfoDefocus')}
                suffix=" mm"
              />
              <CalParamInput
                label="GNIRS"
                value={auxCalParams?.gnirsSfoDefocus}
                onChange={(value) => updateCalParam('gnirsSfoDefocus', value)}
                loading={loading}
                filled={changedKeys.has('gnirsSfoDefocus')}
                suffix=" mm"
              />
            </CalParamInputGroup>

            <CalParamInputGroup title="LGS+P1 defocus" underConstruction>
              <CalParamInput
                label="GMOS P1"
                value={auxCalParams?.gmosP1Defocus}
                onChange={(value) => updateCalParam('gmosP1Defocus', value)}
                loading={loading}
                filled={changedKeys.has('gmosP1Defocus')}
                suffix=" mm"
              />
              <CalParamInput
                label="GMOS OI"
                value={auxCalParams?.gmosOiDefocus}
                onChange={(value) => updateCalParam('gmosOiDefocus', value)}
                loading={loading}
                filled={changedKeys.has('gmosOiDefocus')}
                suffix=" mm"
              />
              <CalParamInput
                label="GNIRS"
                value={auxCalParams?.gnirsP1Defocus}
                onChange={(value) => updateCalParam('gnirsP1Defocus', value)}
                loading={loading}
                filled={changedKeys.has('gnirsP1Defocus')}
                suffix=" mm"
              />
            </CalParamInputGroup>
          </>
        )}
      </div>
    </>
  );
}

function CalParamInput({
  label,
  value,
  loading,
  filled,
  onChange,
  minFractionDigits = 2,
  maxFractionDigits = 10,
  ...props
}: {
  label: string;
  loading: boolean;
  filled: boolean;
  onChange: (value: number) => void;
} & Omit<InputNumberProps, 'onChange'>) {
  const canEdit = useCanEdit();
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <InputNumber
        {...props}
        className={cn('cal-param-input', filled && 'cal-param-input-filled', props.className)}
        inputId={id}
        value={value ?? null}
        minFractionDigits={minFractionDigits}
        maxFractionDigits={maxFractionDigits}
        onChange={(e) => when(e.value, onChange)}
        disabled={loading || !canEdit}
      />
    </>
  );
}

function CalParamInputGroup({
  title,
  children,
  underConstruction,
}: React.PropsWithChildren<{ title: string; underConstruction?: boolean }>) {
  const id = useId();
  return (
    <div className="cal-params-input-group">
      {underConstruction && <Tooltip target={`#${id}-not-implemented`} />}
      <div className="title">
        <span>{title}</span>
        {underConstruction && (
          <span
            id={`${id}-not-implemented`}
            className="under-construction"
            data-pr-tooltip="Not implemented yet. Not used for any functionality."
          >
            <TriangleExclamation />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
