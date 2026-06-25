import { isNullish, parseNumber, when } from '@gemini-hlsw/lucuma-common-ui';
import { dms2deg, hms2deg, toAngle, toDeclination, toRightAscension } from '@gemini-hlsw/lucuma-core';
import type { EphemerisKeyType } from '@gql/odb/gen/graphql';
import { isBaseTarget } from '@gql/util';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { startTransition, useEffect, useState } from 'react';

import { useTargetEditValue } from '@/components/atoms/target';
import type { NonsiderealTarget, SiderealTarget, Target } from '@/types';

type CoordsType = 'celestial' | 'horizontal';

export function TargetContent({
  auxTarget,
  setAuxTarget,
  disabled,
  loading,
}: {
  auxTarget: Target | null;
  setAuxTarget: Dispatch<SetStateAction<Target | null>>;
  disabled: boolean;
  loading: boolean;
}) {
  const [coordsType, setCoordsType] = useState<CoordsType>('celestial');

  const targetEdit = useTargetEditValue();

  useEffect(() => {
    if (targetEdit !== undefined) {
      startTransition(() => {
        setAuxTarget(() => targetEdit.target ?? null);
        if (targetEdit.target?.type === 'FIXED') {
          setCoordsType('horizontal');
        } else {
          setCoordsType('celestial');
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
          setAuxTarget={setAuxTarget}
          disabled={disabled}
          loading={loading}
          isTargetBase={isBaseTarget(auxTarget)}
          coordsType={coordsType}
          setCoordsType={setCoordsType}
        />
      )}
      {auxTarget?.nonsidereal && (
        <NonsiderealInput
          auxTarget={auxTarget.nonsidereal}
          setAuxTarget={setAuxTarget}
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
}: {
  type: string;
  auxTarget: SiderealTarget | null;
  setAuxTarget: Dispatch<SetStateAction<Target | null>>;
  disabled: boolean;
  loading: boolean;
  isTargetBase: boolean;
  coordsType: CoordsType;
  setCoordsType: Dispatch<SetStateAction<CoordsType>>;
}) {
  const setSidereal = (setState: (prev: SiderealTarget | null) => SiderealTarget | null) =>
    setAuxTarget((prev) => ({ ...prev!, sidereal: setState(prev?.sidereal ?? null) }));

  const c1String = coordsType === 'celestial' ? auxTarget?.ra?.hms : auxTarget?.az?.dms;
  const c2String = coordsType === 'celestial' ? auxTarget?.dec?.dms : auxTarget?.el?.dms;

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
          const value = e.value as string;
          if (value === 'celestial' && coordsType === 'horizontal') {
            setAuxTarget((prev) => ({
              ...prev!,
              sidereal: {
                ...prev!.sidereal!,
                ra: when(prev?.sidereal?.az, (az) => ({
                  ...prev!.sidereal!.ra!,
                  ...tryToRightAscension(az.degrees),
                })),
                dec: when(prev?.sidereal?.el, (el) => ({
                  ...prev!.sidereal!.dec!,
                  ...tryToDeclination(el.degrees),
                })),
                az: null,
                el: null,
              },
              type: 'SCIENCE',
            }));
          } else if (value === 'horizontal' && coordsType === 'celestial') {
            setAuxTarget((prev) => ({
              ...prev!,
              sidereal: {
                ...prev!.sidereal!,
                az: when(prev?.sidereal?.ra, (ra) => ({
                  ...prev!.sidereal!.az!,
                  ...tryToAngle(ra.degrees),
                })),
                el: when(prev?.sidereal?.dec, (dec) => ({
                  ...prev!.sidereal!.el!,
                  ...tryToAngle(dec.degrees),
                })),
                ra: null,
                dec: null,
              },
              type: 'FIXED',
            }));
          }
          setCoordsType(value as CoordsType);
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
        value={parseNumber(coordsType === 'celestial' ? auxTarget?.ra?.degrees : auxTarget?.az?.degrees) ?? null}
        suffix="°"
        onValueChange={(e) => {
          if (coordsType === 'celestial') {
            setSidereal((prev) => ({
              ...prev!,
              ra: {
                ...prev!.ra!,
                ...tryToRightAscension(e.target.value ?? 0),
              },
            }));
          } else {
            setSidereal((prev) => ({
              ...prev!,
              az: {
                ...prev!.az!,
                ...tryToAngle(e.target.value ?? 0),
              },
            }));
          }
        }}
      />
      <label htmlFor="raAzDegrees" style={{ gridArea: 'f11' }} className="label">
        degrees
      </label>
      <AngleTextInput
        id="raAzHmsDms"
        disabled={disabled || loading}
        style={{ gridArea: 'c12' }}
        value={c1String}
        onCommit={(text) => {
          if (coordsType === 'celestial') {
            setSidereal((prev) => ({
              ...prev!,
              ra: { ...prev!.ra!, ...tryToRightAscension(text) },
            }));
          } else {
            setSidereal((prev) => ({
              ...prev!,
              az: { ...prev!.az!, ...tryToAngle(text) },
            }));
          }
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
        value={parseNumber(coordsType === 'celestial' ? auxTarget?.dec?.degrees : auxTarget?.el?.degrees) ?? null}
        suffix="°"
        onValueChange={(e) => {
          if (coordsType === 'celestial') {
            setSidereal((prev) => ({
              ...prev!,
              dec: {
                ...prev!.dec!,
                ...tryToDeclination(e.target.value ?? 0),
              },
            }));
          } else {
            setSidereal((prev) => ({
              ...prev!,
              el: {
                ...prev!.el!,
                ...tryToAngle(e.target.value ?? 0),
              },
            }));
          }
        }}
      />
      <label htmlFor="decElDegrees" style={{ gridArea: 'f21' }} className="label">
        degrees
      </label>
      <AngleTextInput
        id="decElDms"
        disabled={disabled || loading}
        style={{ gridArea: 'c22' }}
        value={c2String}
        onCommit={(text) => {
          if (coordsType === 'celestial') {
            setSidereal((prev) => ({
              ...prev!,
              dec: {
                ...prev!.dec!,
                ...tryToDeclination(text),
              },
            }));
          } else {
            setSidereal((prev) => ({
              ...prev!,
              el: {
                ...prev!.el!,
                ...tryToAngle(text),
              },
            }));
          }
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
        onChange={(e) => setSidereal((prev) => ({ ...prev!, epoch: e.target.value }))}
      />
    </>
  );
}

/**
 * Text input for an hms/dms angle that keeps the user's in-progress text while editing
 */
function AngleTextInput({
  id,
  value,
  disabled,
  style,
  onCommit,
}: {
  id: string;
  value: string | undefined;
  disabled: boolean;
  style: CSSProperties;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const isEditing = draft !== undefined;

  const commit = () => {
    if (isEditing) {
      onCommit(draft);
      setDraft(undefined);
    }
  };

  return (
    <InputText
      id={id}
      disabled={disabled}
      style={style}
      value={isEditing ? draft : (value ?? '')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function NonsiderealInput({
  auxTarget,
  setAuxTarget,
  disabled,
  loading,
}: {
  auxTarget: NonsiderealTarget | null;
  setAuxTarget: Dispatch<SetStateAction<Target | null>>;
  disabled: boolean;
  loading: boolean;
}) {
  const setNonsidereal = (setState: (prev: NonsiderealTarget | null) => NonsiderealTarget | null) =>
    setAuxTarget((prev) => ({ ...prev!, nonsidereal: setState(prev?.nonsidereal ?? null) }));

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
        onChange={(e) => setNonsidereal((prev) => ({ ...prev!, des: e.target.value }))}
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
        onChange={(e) => setNonsidereal((prev) => ({ ...prev!, keyType: e.value as EphemerisKeyType }))}
        placeholder="Select key type"
      />
    </>
  );
}

function makeTryToConverter<T>(
  parseColon: (value: string) => number,
  convert: (degrees: number) => T,
): (value: string | number) => T | undefined {
  return (value) => {
    try {
      const num = typeof value === 'string' && value.includes(':') ? parseColon(value) : parseNumber(value);
      if (!isNullish(num) && !isNaN(num)) {
        return convert(num);
      } else {
        return undefined;
      }
    } catch {
      return undefined;
    }
  };
}

const tryToAngle = makeTryToConverter(dms2deg, toAngle);
const tryToDeclination = makeTryToConverter(dms2deg, toDeclination);
const tryToRightAscension = makeTryToConverter(hms2deg, toRightAscension);
