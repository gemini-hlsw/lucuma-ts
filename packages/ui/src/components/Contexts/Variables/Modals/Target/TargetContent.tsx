import { deg2dms, deg2hms, dms2deg, hms2deg } from '@gemini-hlsw/lucuma-core';
import type {
  EphemerisKeyType,
  NonsiderealTargetItemFragment,
  SiderealTargetItemFragment,
} from '@gql/configs/gen/graphql';
import { isBaseTarget } from '@gql/util';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import type { Dispatch, SetStateAction } from 'react';
import { startTransition, useEffect, useState } from 'react';

import { useTargetEditValue } from '@/components/atoms/target';
import type { TargetType } from '@/types';

export function TargetContent({
  auxTarget,
  setAuxTarget,
  disabled,
  loading,
}: {
  auxTarget: TargetType | null;
  setAuxTarget: Dispatch<SetStateAction<TargetType | null>>;
  disabled: boolean;
  loading: boolean;
}) {
  const [coordsType, setCoordsType] = useState('celestial');
  const [c1String, setc1String] = useState<string | undefined>('');
  const [c2String, setc2String] = useState<string | undefined>('');

  const targetEdit = useTargetEditValue();

  useEffect(() => {
    if (targetEdit !== undefined) {
      startTransition(() => {
        setAuxTarget(() => targetEdit.target ?? null);
        if (targetEdit.target?.type === 'FIXED') {
          setc1String(targetEdit.target.sidereal?.az?.dms ?? '');
          setc2String(targetEdit.target.sidereal?.el?.dms ?? '');
          setCoordsType('horizontal');
        } else {
          setCoordsType('celestial');
          setc1String(targetEdit.target?.sidereal?.ra?.hms ?? '');
          setc2String(targetEdit.target?.sidereal?.dec?.dms ?? '');
        }
      });
    }
  }, [targetEdit, setAuxTarget]);

  return (
    <div className="target-edit">
      <label htmlFor="targetName" style={{ gridArea: 's1' }} className="label">
        Name
      </label>
      <InputText
        id="targetName"
        disabled={disabled || loading}
        style={{ gridArea: 's2' }}
        value={auxTarget?.name ?? ''}
        onChange={(e) => setAuxTarget((prev) => ({ ...prev!, name: e.target.value }))}
      />

      {auxTarget?.sidereal && (
        <SiderealInput
          type={auxTarget.type}
          auxTarget={auxTarget.sidereal}
          setAuxTarget={(setState) =>
            setAuxTarget((prev) => ({
              ...prev!,
              sidereal: setState(prev?.sidereal ?? null),
            }))
          }
          disabled={disabled}
          loading={loading}
          isTargetBase={isBaseTarget(auxTarget)}
          coordsType={coordsType}
          setCoordsType={setCoordsType}
          c1String={c1String}
          setc1String={setc1String}
          c2String={c2String}
          setc2String={setc2String}
        />
      )}
      {auxTarget?.nonsidereal && (
        <NonsiderealInput
          auxTarget={auxTarget.nonsidereal}
          setAuxTarget={(setState) =>
            setAuxTarget((prev) => ({
              ...prev!,
              nonsidereal: setState(prev?.nonsidereal ?? null),
            }))
          }
          disabled={disabled}
          loading={loading}
        />
      )}
    </div>
  );
}

function SiderealInput({
  type,
  auxTarget,
  setAuxTarget,
  disabled,
  loading,
  isTargetBase,
  coordsType,
  setCoordsType,
  c1String,
  setc1String,
  c2String,
  setc2String,
}: {
  type: string;
  auxTarget: SiderealTargetItemFragment | null;
  setAuxTarget: Dispatch<(prevState: SiderealTargetItemFragment | null) => SiderealTargetItemFragment | null>;
  disabled: boolean;
  loading: boolean;
  isTargetBase: boolean;
  coordsType: string;
  setCoordsType: Dispatch<SetStateAction<string>>;
  c1String: string | undefined;
  setc1String: Dispatch<SetStateAction<string | undefined>>;
  c2String: string | undefined;
  setc2String: Dispatch<SetStateAction<string | undefined>>;
}) {
  return (
    <>
      <label htmlFor="coordsType" style={{ gridArea: 'l1' }} className="label">
        Coordinates
      </label>
      <Dropdown
        inputId="coordsType"
        disabled={!isTargetBase || disabled}
        loading={loading}
        style={{ gridArea: 'd1' }}
        value={coordsType}
        options={['celestial', 'horizontal']}
        onChange={(e) => {
          let stringC1 = '';
          let stringC2 = '';
          const value = e.value as string;
          if (value === 'celestial' && coordsType === 'horizontal') {
            stringC1 = deg2hms(auxTarget?.az?.degrees ?? 0);
            stringC2 = deg2dms(auxTarget?.el?.degrees ?? 0);
            setAuxTarget((prev) => ({
              ...prev!,
              ra: prev!.az && {
                ...prev!.ra!,
                degrees: prev!.az.degrees,
                hms: stringC1,
              },
              dec: prev!.el && {
                ...prev!.dec!,
                degrees: prev!.el.degrees,
                dms: stringC2,
              },
              az: null,
              el: null,
              type: 'SCIENCE',
            }));
          } else if (value === 'horizontal' && coordsType === 'celestial') {
            stringC1 = deg2dms(auxTarget?.ra?.degrees ?? 0);
            stringC2 = deg2dms(auxTarget?.dec?.degrees ?? 0);
            setAuxTarget((prev) => ({
              ...prev!,
              az: prev!.ra && {
                ...prev!.az!,
                degrees: prev!.ra.degrees,
                dms: deg2dms(prev?.ra?.degrees ?? 0),
              },
              el: prev!.dec && {
                ...prev!.el!,
                degrees: prev!.dec.degrees,
                dms: deg2dms(prev?.dec?.degrees ?? 0),
              },
              ra: null,
              dec: null,
              type: 'FIXED',
            }));
          }
          setc1String(stringC1);
          setc2String(stringC2);
          setCoordsType(value);
        }}
        placeholder="Select coordinates type"
      />
      <label htmlFor="raAzDegrees" style={{ gridArea: 't1' }} className="label">
        {coordsType === 'celestial' ? 'RA' : 'Az'}
      </label>
      <InputNumber
        inputId="raAzDegrees"
        disabled={disabled || loading}
        style={{ gridArea: 'c11' }}
        value={(coordsType === 'celestial' ? auxTarget?.ra?.degrees : auxTarget?.az?.degrees) ?? null}
        suffix="°"
        onValueChange={(e) => {
          let stringC1 = '';
          if (coordsType === 'celestial') {
            stringC1 = deg2hms(e.target.value ?? 0);
            setAuxTarget((prev) => ({
              ...prev!,
              ra: {
                ...prev!.ra!,
                degrees: e.target.value!,
                hms: stringC1,
              },
            }));
          } else {
            stringC1 = deg2dms(e.target.value ?? 0);
            setAuxTarget((prev) => ({
              ...prev!,
              az: {
                ...prev!.az!,
                degrees: e.target.value!,
                dms: stringC1,
              },
            }));
          }
        }}
        onBlur={() => {
          if (coordsType === 'celestial') {
            setc1String(auxTarget?.ra?.hms ?? undefined);
          } else {
            setc1String(auxTarget?.az?.dms ?? undefined);
          }
        }}
      />
      <label htmlFor="raAzDegrees" style={{ gridArea: 'f11' }} className="label">
        degrees
      </label>
      <InputText
        id="raAzHmsDms"
        disabled={disabled || loading}
        style={{ gridArea: 'c12' }}
        value={c1String}
        onChange={(e) => {
          if (coordsType === 'celestial') {
            setAuxTarget((prev) => ({
              ...prev!,
              ra: { ...prev!.ra!, degrees: hms2deg(e.target.value), hms: e.target.value },
            }));
          } else {
            setAuxTarget((prev) => ({
              ...prev!,
              az: { ...prev!.az!, degrees: dms2deg(e.target.value), dms: e.target.value },
            }));
          }
          setc1String(e.target.value);
        }}
      />
      <label htmlFor="raAzHmsDms" style={{ gridArea: 'f12' }} className="label">
        {coordsType === 'celestial' ? 'hms' : 'dms'}
      </label>
      <label htmlFor="decElDegrees" style={{ gridArea: 't2' }} className="label">
        {coordsType === 'celestial' ? 'Dec' : 'El'}
      </label>
      <InputNumber
        inputId="decElDegrees"
        disabled={disabled || loading}
        style={{ gridArea: 'c21' }}
        value={(coordsType === 'celestial' ? auxTarget?.dec?.degrees : auxTarget?.el?.degrees) ?? null}
        suffix="°"
        onValueChange={(e) => {
          const stringC2 = deg2dms(e.target.value ?? 0);
          if (coordsType === 'celestial') {
            setAuxTarget((prev) => ({
              ...prev!,
              dec: {
                ...prev!.dec!,
                degrees: e.target.value!,
                dms: stringC2,
              },
            }));
          } else {
            setAuxTarget((prev) => ({
              ...prev!,
              el: {
                ...prev!.el!,
                degrees: e.target.value!,
                dms: stringC2,
              },
            }));
          }
        }}
        onBlur={() => {
          if (coordsType === 'celestial') {
            setc2String(auxTarget?.dec?.dms ?? undefined);
          } else {
            setc2String(auxTarget?.el?.dms ?? undefined);
          }
        }}
      />
      <label htmlFor="decElDegrees" style={{ gridArea: 'f21' }} className="label">
        degrees
      </label>
      <InputText
        id="decElDms"
        disabled={disabled || loading}
        style={{ gridArea: 'c22' }}
        value={c2String}
        onChange={(e) => {
          if (coordsType === 'celestial') {
            setAuxTarget((prev) => ({
              ...prev!,
              dec: {
                ...prev!.dec!,
                degrees: dms2deg(e.target.value),
                dms: e.target.value,
              },
            }));
          } else {
            setAuxTarget((prev) => ({
              ...prev!,
              el: {
                ...prev!.el!,
                degrees: dms2deg(e.target.value),
                dms: e.target.value,
              },
            }));
          }
          setc2String(e.target.value);
        }}
      />
      <label htmlFor="decElDms" style={{ gridArea: 'f22' }} className="label">
        dms
      </label>
      <label htmlFor="targetEpoch" style={{ gridArea: 's3' }} className="label">
        Epoch
      </label>
      <InputText
        id="targetEpoch"
        disabled={disabled || loading}
        style={{ gridArea: 's4' }}
        value={(type === 'FIXED' ? '' : auxTarget?.epoch) ?? ''}
        onChange={(e) => setAuxTarget((prev) => ({ ...prev!, epoch: e.target.value }))}
      />
    </>
  );
}

function NonsiderealInput({
  auxTarget,
  setAuxTarget,
  disabled,
  loading,
}: {
  auxTarget: NonsiderealTargetItemFragment | null;
  setAuxTarget: Dispatch<(prevState: NonsiderealTargetItemFragment | null) => NonsiderealTargetItemFragment | null>;
  disabled: boolean;
  loading: boolean;
}) {
  const keyTypeOptions: EphemerisKeyType[] = ['ASTEROID_NEW', 'ASTEROID_OLD', 'COMET', 'MAJOR_BODY', 'USER_SUPPLIED'];

  return (
    <>
      <label htmlFor="nonsiderealDES" style={{ gridArea: 's5' }} className="label">
        DES
      </label>
      <InputText
        id="nonsiderealDES"
        disabled={disabled || loading}
        style={{ gridArea: 's6' }}
        value={auxTarget?.des ?? ''}
        onChange={(e) => setAuxTarget((prev) => ({ ...prev!, des: e.target.value }))}
      />

      <label htmlFor="nonsiderealKeyType" style={{ gridArea: 's7' }} className="label">
        Key Type
      </label>
      <Dropdown
        inputId="nonsiderealKeyType"
        disabled={disabled || loading}
        style={{ gridArea: 's8' }}
        value={auxTarget?.keyType ?? null}
        options={keyTypeOptions}
        onChange={(e) => setAuxTarget((prev) => ({ ...prev!, keyType: e.value as EphemerisKeyType }))}
        placeholder="Select key type"
      />
    </>
  );
}
