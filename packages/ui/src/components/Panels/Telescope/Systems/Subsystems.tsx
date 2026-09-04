import {
  cn,
  isNotNullish,
  isNullish,
  type Labelled,
  NumberInput,
  parseNumber,
  useSyncedState,
  when,
} from '@gemini-hlsw/lucuma-common-ui';
import { useMechanism } from '@gql/configs/Mechanism';
import {
  CrcsPark,
  CrcsUnwrap,
  EcsCloseEastVentGate,
  EcsCloseWestVentGate,
  EcsDomePark,
  EcsEnableDome,
  EcsEnableShutters,
  EcsMoveEastVentGate,
  EcsMoveWestVentGate,
  EcsShuttersPark,
  McsPark,
  McsUnwrap,
  OiwfsPark,
  Pwfs1Park,
  Pwfs1Unwrap,
  Pwfs2Park,
  Pwfs2Unwrap,
} from '@gql/server/Buttons';
import type { DomeMode, ShutterControlMode } from '@gql/server/gen/graphql';
import { useTelescopeState } from '@gql/server/TelescopeState';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Slider } from 'primereact/slider';

import { TriangleExclamation } from '@/components/Icons';
import { BTN_CLASSES } from '@/Helpers/constants';
import type { Mechanism } from '@/types';

export function TopSubsystems({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="top-left">
      <McsPark disabled={!canEdit} style={{ gridArea: 'g11' }} label="Park" data-testid="park-mcs" />
      <McsUnwrap disabled={!canEdit} style={{ gridArea: 'g12' }} label="Unwrap" data-testid="unwrap-mcs" />
      <CrcsPark disabled={!canEdit} style={{ gridArea: 'g31' }} label="Park" data-testid="park-crcs" />
      <CrcsUnwrap disabled={!canEdit} style={{ gridArea: 'g32' }} label="Unwrap" data-testid="unwrap-crcs" />
      <Pwfs1Park disabled={!canEdit} style={{ gridArea: 'g41' }} label="Park" data-testid="park-pwfs1" />
      <Pwfs1Unwrap disabled={!canEdit} style={{ gridArea: 'g42' }} label="Unwrap" data-testid="unwrap-pwfs1" />
      <Pwfs2Park disabled={!canEdit} style={{ gridArea: 'g51' }} label="Park" data-testid="park-pwfs2" />
      <Pwfs2Unwrap disabled={!canEdit} style={{ gridArea: 'g52' }} label="Unwrap" data-testid="unwrap-pwfs2" />
    </div>
  );
}

const DOME_MODE: Labelled<DomeMode>[] = [
  { label: 'Min Vibration', value: 'MIN_VIBRATION' },
  { label: 'Min Scatter', value: 'MIN_SCATTER' },
  { label: 'Basic', value: 'BASIC' },
];

const SHUTTER_MODE: Labelled<ShutterControlMode>[] = [
  { label: 'Tracking', value: 'TRACKING' },
  { label: 'Fully Open', value: 'FULLY_OPEN' },
];

const APERTURE_RANGE = { min: 0, max: 100, step: 1 };

export function BotSubsystems({ canEdit }: { canEdit: boolean }) {
  const { data, loading: mechanismLoading } = useMechanism();
  const { data: telescopeData, loading: telescopeLoading } = useTelescopeState({ useStale: false });

  const enclosure = telescopeData?.enclosure;
  const domeStateMode = enclosure?.domeMode;
  const shutterStateMode = enclosure?.shuttersMode?.mode;
  const shutterStateAperture = parseNumber(enclosure?.shuttersMode?.aperture?.meters) ?? null;
  const westVentGateState = enclosure?.westVentGateAperture ?? null;
  const eastVentGateState = enclosure?.eastVentGateAperture ?? null;

  const [domeMode, setDomeMode] = useSyncedState(domeStateMode, null);
  const [shutterMode, setShutterMode] = useSyncedState(shutterStateMode, null);
  const [aperture, setAperture] = useSyncedState(shutterStateAperture, null);
  const [WVGate, setWVGate] = useSyncedState<number | null>(westVentGateState, null);
  const [EVGate, setEVGate] = useSyncedState<number | null>(eastVentGateState, null);

  const state = data?.mechanism ?? ({} as Mechanism);

  const loading = mechanismLoading || telescopeLoading;

  const domeOff = !enclosure?.domeEnabled;
  const shuttersOff = !enclosure?.shuttersEnabled;
  const domeModeDirty = isNotNullish(domeMode) && (domeOff || domeMode !== domeStateMode);
  const shutterModeDirty =
    isNotNullish(shutterMode) && (shuttersOff || shutterMode !== shutterStateMode || aperture !== shutterStateAperture);
  const westVentGateDirty = isNotNullish(westVentGateState) && WVGate !== westVentGateState;
  const eastVentGateDirty = isNotNullish(eastVentGateState) && EVGate !== eastVentGateState;

  const dirtyButtonIcon = <TriangleExclamation />;

  return (
    <div className="bottom">
      <OiwfsPark disabled={!canEdit} loading={loading} style={{ gridArea: 'g11' }} label="Park" />
      <Button
        disabled={!canEdit}
        loading={loading}
        style={{ gridArea: 'g21' }}
        label="Park"
        className={cn(BTN_CLASSES[state.odgwPark], 'under-construction')}
      />
      <Button
        disabled={!canEdit}
        style={{ gridArea: 'g31' }}
        label="Park"
        className={cn(BTN_CLASSES[state.aowfsPark], 'under-construction')}
      />
      <EcsDomePark
        disabled={!canEdit}
        loading={loading}
        style={{ gridArea: 'g41' }}
        label="Park"
        className={cn(BTN_CLASSES[state.domePark])}
        data-testid="park-dome"
      />
      <label
        htmlFor="dome-mode"
        style={{
          textAlign: 'center',
          alignSelf: 'center',
          gridArea: 'g42',
        }}
      >
        Mode
      </label>
      <Dropdown
        inputId="dome-mode"
        disabled={!canEdit}
        style={{ gridArea: 'g43' }}
        value={domeMode}
        options={DOME_MODE}
        onChange={(e) => setDomeMode(e.value as DomeMode)}
        placeholder="Select a Dome Mode"
      />
      <EcsEnableDome
        mode={domeMode}
        disabled={!canEdit || !domeModeDirty}
        style={{ gridArea: 'g46' }}
        label="Set"
        data-testid="set-dome-mode"
        icon={domeModeDirty ? dirtyButtonIcon : undefined}
        className={domeModeDirty ? BTN_CLASSES.ACTIVE : undefined}
        tooltip={when(domeModeDirty, () => (domeOff ? 'Press Set to enable the dome' : 'Selected mode is not applied'))}
      />
      <EcsShuttersPark
        disabled={!canEdit}
        loading={loading}
        style={{ gridArea: 'g51' }}
        label="Park"
        className={cn(BTN_CLASSES[state.shuttersPark])}
        data-testid="park-shutters"
      />
      <label
        htmlFor="shutter-mode"
        style={{
          textAlign: 'center',
          alignSelf: 'center',
          gridArea: 'g52',
        }}
      >
        Mode
      </label>
      <Dropdown
        inputId="shutter-mode"
        disabled={!canEdit}
        style={{ gridArea: 'g53' }}
        value={shutterMode}
        options={SHUTTER_MODE}
        onChange={(e) => setShutterMode(e.value as ShutterControlMode)}
        placeholder="Select a Shutter Mode"
      />
      <label
        htmlFor="aperture"
        style={{
          textAlign: 'center',
          alignSelf: 'center',
          gridArea: 'g54',
        }}
      >
        Aperture
      </label>
      <NumberInput
        inputId="aperture"
        disabled={!canEdit}
        style={{ gridArea: 'g55' }}
        value={aperture}
        onValueChange={(e) => setAperture(e.value ?? null)}
        suffix="m"
        minFractionDigits={2}
        maxFractionDigits={2}
      />
      <EcsEnableShutters
        mode={shutterMode}
        aperture={aperture}
        disabled={!canEdit || !shutterModeDirty}
        style={{ gridArea: 'g56' }}
        label="Set"
        data-testid="set-shutter-mode"
        icon={shutterModeDirty ? dirtyButtonIcon : undefined}
        className={shutterModeDirty ? BTN_CLASSES.ACTIVE : undefined}
        tooltip={when(shutterModeDirty, () =>
          shuttersOff ? 'Press Set to enable the shutters' : 'Selected mode is not applied',
        )}
      />
      <EcsCloseWestVentGate
        disabled={!canEdit}
        style={{ gridArea: 'g61' }}
        label="Close"
        className={cn(BTN_CLASSES[state.wVGateClose])}
        data-testid="close-west-vent-gate"
      />
      <NumberInput
        inputId="west-vent-gate"
        aria-label="West vent gate"
        disabled={!canEdit}
        style={{ gridArea: 'g62' }}
        value={WVGate}
        onValueChange={(e) => setWVGate(e.value ?? null)}
        mode="decimal"
        {...APERTURE_RANGE}
        minFractionDigits={0}
        maxFractionDigits={0}
      />
      <Slider
        disabled={!canEdit || isNullish(WVGate)}
        style={{ gridArea: 'g63', marginTop: '10px' }}
        value={WVGate ?? APERTURE_RANGE.min}
        onChange={(e) => setWVGate(e.value as number)}
        {...APERTURE_RANGE}
      />
      <EcsMoveWestVentGate
        position={WVGate}
        disabled={!canEdit || !westVentGateDirty}
        style={{ gridArea: 'g66' }}
        label="Move"
        data-testid="move-west-vent-gate"
        icon={westVentGateDirty ? dirtyButtonIcon : undefined}
        className={westVentGateDirty ? BTN_CLASSES.ACTIVE : undefined}
        tooltip={westVentGateDirty ? 'Selected position is not applied' : undefined}
      />
      <EcsCloseEastVentGate
        disabled={!canEdit}
        style={{ gridArea: 'g71' }}
        label="Close"
        className={cn(BTN_CLASSES[state.eVGateClose])}
        data-testid="close-east-vent-gate"
      />
      <NumberInput
        inputId="east-vent-gate"
        aria-label="East vent gate"
        disabled={!canEdit}
        style={{ gridArea: 'g72' }}
        value={EVGate}
        onValueChange={(e) => setEVGate(e.value ?? null)}
        mode="decimal"
        {...APERTURE_RANGE}
        minFractionDigits={0}
        maxFractionDigits={0}
      />
      <Slider
        disabled={!canEdit || isNullish(EVGate)}
        style={{ gridArea: 'g73', marginTop: '10px' }}
        value={EVGate ?? APERTURE_RANGE.min}
        onChange={(e) => setEVGate(e.value as number)}
        {...APERTURE_RANGE}
      />
      <EcsMoveEastVentGate
        position={EVGate}
        disabled={!canEdit || !eastVentGateDirty}
        style={{ gridArea: 'g76' }}
        label="Move"
        data-testid="move-east-vent-gate"
        icon={eastVentGateDirty ? dirtyButtonIcon : undefined}
        className={eastVentGateDirty ? BTN_CLASSES.ACTIVE : undefined}
        tooltip={eastVentGateDirty ? 'Selected position is not applied' : undefined}
      />
    </div>
  );
}
