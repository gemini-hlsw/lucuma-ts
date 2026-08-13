/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import type { ApolloCache, MutationUpdaterFunction, OperationVariables } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { cn, isNullish, when } from '@gemini-hlsw/lucuma-common-ui';
import { useConfiguration } from '@gql/configs/Configuration';
import { useSlewFlags } from '@gql/configs/SlewFlags';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useTcsConfigInput } from '@Telescope/Targets/inputs';
import type { ButtonProps } from 'primereact/button';
import { Button } from 'primereact/button';
import type { ReactNode } from 'react';

import { Crosshairs, CrosshairsSlash, Parking, ParkingSlash } from '@/components/Icons';
import { BTN_CLASSES } from '@/Helpers/constants';
import type { SetStale } from '@/Helpers/hooks';
import type { EnclosureState, MechSystemState, SlewFlags, TelescopeState } from '@/types';

import {
  AG_ALL_PARK_MUTATION,
  AG_AO_FOLD_PARK_MUTATION,
  AG_PICKOFF_MIRROR_PARK_MUTATION,
  AG_SCIENCE_FOLD_PARK_MUTATION,
} from './AgMechanism';
import {
  ECS_CLOSE_EAST_VENT_GATE_MUTATION,
  ECS_CLOSE_WEST_VENT_GATE_MUTATION,
  ECS_DISABLE_DOME_MUTATION,
  ECS_DISABLE_SHUTTERS_MUTATION,
  ECS_DOME_PARK_MUTATION,
  ECS_ENABLE_DOME_MUTATION,
  ECS_ENABLE_SHUTTERS_MUTATION,
  ECS_MOVE_EAST_VENT_GATE_MUTATION,
  ECS_MOVE_WEST_VENT_GATE_MUTATION,
  ECS_SHUTTERS_PARK_MUTATION,
} from './ecs';
import {
  MOUNT_FOLLOW_MUTATION,
  OIWFS_FOLLOW_MUTATION,
  PWFS1_FOLLOW_MUTATION,
  PWFS2_FOLLOW_MUTATION,
  ROTATOR_FOLLOW_MUTATION,
  SCS_FOLLOW_MUTATION,
} from './follow';
import type { DomeMode, RunSlewMutationVariables, ShutterControlMode, ShutterModeInput } from './gen/graphql';
import {
  MOUNT_PARK_MUTATION,
  MOUNT_UNWRAP_MUTATION,
  OIWFS_PARK_MUTATION,
  PWFS1_PARK_MUTATION,
  PWFS1_UNWRAP_MUTATION,
  PWFS2_PARK_MUTATION,
  PWFS2_UNWRAP_MUTATION,
  ROTATOR_PARK_MUTATION,
  ROTATOR_UNWRAP_MUTATION,
} from './park';
import { SLEW_MUTATION } from './Slew';
import { GET_TELESCOPE_STATE } from './TelescopeState';

// Generic mutation button
function MutationButton<TResult, TVariables extends OperationVariables>({
  mutation,
  variables,
  setStale,
  icons,
  label,
  update,
  ...props
}: {
  mutation: TypedDocumentNode<TResult, TVariables>;
  variables: TVariables;
  icons?: ReactNode[];
  setStale?: SetStale;
  update?: MutationUpdaterFunction<TResult, TVariables, ApolloCache>;
} & ButtonProps) {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const [mutationFunction, { loading }] = useMutation<TResult, TVariables>(mutation, {
    variables: variables,
    onCompleted: () => setStale?.(true),
  });

  return (
    <Button {...props} onClick={() => mutationFunction({ variables, update })} loading={props.loading || loading}>
      {icons?.length && <span className="mutation-button-icons">{icons}</span>}
      {label && <span className="p-button-label">{label}</span>}
    </Button>
  );
}

// BUTTONS

export function MCS({ className, state, ...props }: ButtonProps & { state: MechSystemState | undefined }) {
  const { classes, title, icons } = classNameForState(state, true);

  return (
    <MutationButton
      mutation={MOUNT_FOLLOW_MUTATION}
      variables={{ enable: state?.follow === 'NOT_FOLLOWING' }}
      update={(cache, _result, { variables }) =>
        updateTelescopeStateCache(cache, (telescopeState) => ({
          ...telescopeState,
          mount: {
            ...telescopeState.mount,
            follow: variables?.enable ? 'FOLLOWING' : 'NOT_FOLLOWING',
          },
        }))
      }
      {...props}
      icons={icons}
      title={title}
      className={cn(className, classes)}
    />
  );
}

export function SCS({ className, state, ...props }: ButtonProps & { state: MechSystemState | undefined }) {
  const { classes, title, icons } = classNameForState(state, true);
  return (
    <MutationButton
      mutation={SCS_FOLLOW_MUTATION}
      icons={icons}
      variables={{ enable: state?.follow === 'NOT_FOLLOWING' }}
      update={(cache, _result, { variables }) =>
        updateTelescopeStateCache(cache, (telescopeState) => ({
          ...telescopeState,
          scs: {
            ...telescopeState.mount,
            follow: variables?.enable ? 'FOLLOWING' : 'NOT_FOLLOWING',
          },
        }))
      }
      {...props}
      title={title}
      className={cn(className, classes)}
    />
  );
}

export function CRCS({ className, state, ...props }: ButtonProps & { state: MechSystemState | undefined }) {
  const { classes, title, icons } = classNameForState(state, true);
  return (
    <MutationButton
      mutation={ROTATOR_FOLLOW_MUTATION}
      icons={icons}
      variables={{ enable: state?.follow === 'NOT_FOLLOWING' }}
      update={(cache, _result, { variables }) =>
        updateTelescopeStateCache(cache, (telescopeState) => ({
          ...telescopeState,
          crcs: {
            ...telescopeState.mount,
            follow: variables?.enable ? 'FOLLOWING' : 'NOT_FOLLOWING',
          },
        }))
      }
      {...props}
      title={title}
      className={cn(className, classes)}
    />
  );
}

export function PWFS1({
  className,
  state,
  inUse,
  ...props
}: ButtonProps & { state: MechSystemState | undefined; inUse: boolean }) {
  const { classes, title, icons } = classNameForState(state, inUse);
  return (
    <MutationButton
      mutation={PWFS1_FOLLOW_MUTATION}
      icons={icons}
      variables={{ enable: state?.follow === 'NOT_FOLLOWING' }}
      update={(cache, _result, { variables }) =>
        updateTelescopeStateCache(cache, (telescopeState) => ({
          ...telescopeState,
          pwfs1: {
            ...telescopeState.pwfs1,
            follow: variables?.enable ? 'FOLLOWING' : 'NOT_FOLLOWING',
          },
        }))
      }
      {...props}
      title={title}
      className={cn(className, classes)}
    />
  );
}

export function PWFS2({
  className,
  state,
  inUse,
  ...props
}: ButtonProps & { state: MechSystemState | undefined; inUse: boolean }) {
  const { classes, title, icons } = classNameForState(state, inUse);
  return (
    <MutationButton
      mutation={PWFS2_FOLLOW_MUTATION}
      icons={icons}
      variables={{ enable: state?.follow === 'NOT_FOLLOWING' }}
      update={(cache, _result, { variables }) =>
        updateTelescopeStateCache(cache, (telescopeState) => ({
          ...telescopeState,
          pwfs2: {
            ...telescopeState.pwfs2,
            follow: variables?.enable ? 'FOLLOWING' : 'NOT_FOLLOWING',
          },
        }))
      }
      {...props}
      title={title}
      className={cn(className, classes)}
    />
  );
}

export function AOWFS({ className, ...props }: ButtonProps) {
  // TODO: Implement AOWFS mutation and state
  return <Button {...props} className={cn(className, BTN_CLASSES.INACTIVE)} />;
}

export function OIWFS({
  className,
  state,
  inUse,
  ...props
}: ButtonProps & { state: MechSystemState | undefined; inUse: boolean }) {
  const { classes, title, icons } = classNameForState(state, inUse);
  return (
    <MutationButton
      mutation={OIWFS_FOLLOW_MUTATION}
      update={(cache, _result, { variables }) =>
        updateTelescopeStateCache(cache, (telescopeState) => ({
          ...telescopeState,
          oiwfs: {
            ...telescopeState.oiwfs,
            follow: variables?.enable ? 'FOLLOWING' : 'NOT_FOLLOWING',
          },
        }))
      }
      icons={icons}
      variables={{ enable: state?.follow === 'NOT_FOLLOWING' }}
      {...props}
      title={title}
      className={cn(className, classes)}
    />
  );
}

export function McsPark(props: ButtonProps) {
  return <MutationButton mutation={MOUNT_PARK_MUTATION} variables={{}} {...props} />;
}

export function CrcsPark(props: ButtonProps) {
  return <MutationButton mutation={ROTATOR_PARK_MUTATION} variables={{}} {...props} />;
}

export function OiwfsPark(props: ButtonProps) {
  return <MutationButton mutation={OIWFS_PARK_MUTATION} variables={{}} {...props} />;
}

export function Pwfs1Park(props: ButtonProps) {
  return <MutationButton mutation={PWFS1_PARK_MUTATION} variables={{}} {...props} />;
}

export function Pwfs2Park(props: ButtonProps) {
  return <MutationButton mutation={PWFS2_PARK_MUTATION} variables={{}} {...props} />;
}

export function McsUnwrap(props: ButtonProps) {
  return <MutationButton mutation={MOUNT_UNWRAP_MUTATION} variables={{}} {...props} />;
}

export function CrcsUnwrap(props: ButtonProps) {
  return <MutationButton mutation={ROTATOR_UNWRAP_MUTATION} variables={{}} {...props} />;
}

export function Pwfs1Unwrap(props: ButtonProps) {
  return <MutationButton mutation={PWFS1_UNWRAP_MUTATION} variables={{}} {...props} />;
}

export function Pwfs2Unwrap(props: ButtonProps) {
  return <MutationButton mutation={PWFS2_UNWRAP_MUTATION} variables={{}} {...props} />;
}

export function AgScienceFoldPark(props: ButtonProps) {
  return <MutationButton mutation={AG_SCIENCE_FOLD_PARK_MUTATION} variables={{}} {...props} />;
}

export function AgAoFoldPark(props: ButtonProps) {
  return <MutationButton mutation={AG_AO_FOLD_PARK_MUTATION} variables={{}} {...props} />;
}

export function AgPickoffMirrorPark(props: ButtonProps) {
  return <MutationButton mutation={AG_PICKOFF_MIRROR_PARK_MUTATION} variables={{}} {...props} />;
}

export function AgAllPark(props: ButtonProps) {
  return <MutationButton mutation={AG_ALL_PARK_MUTATION} variables={{}} {...props} />;
}

// ECS
export function EcsDome({ enclosure, ...props }: ButtonProps & { enclosure?: EnclosureState }) {
  if (!enclosure?.domeEnabled) {
    return <Button {...props} disabled title="Select a dome mode and press Set to enable the dome" />;
  }

  return <EcsDisableDome {...props} />;
}

export function EcsShutters({ enclosure, ...props }: ButtonProps & { enclosure?: EnclosureState }) {
  if (!enclosure?.shuttersEnabled) {
    return <Button {...props} disabled title="Select a shutter mode and press Set to enable the shutters" />;
  }

  return <EcsDisableShutters {...props} />;
}

export function EcsEnableDome({ mode, ...props }: ButtonProps & { mode: DomeMode | null }) {
  if (isNullish(mode)) return <Button {...props} disabled />;

  return (
    <MutationButton
      mutation={ECS_ENABLE_DOME_MUTATION}
      variables={{ mode }}
      update={(cache) =>
        updateTelescopeStateCache(cache, (telescopeState) => ({
          ...telescopeState,
          enclosure: {
            ...telescopeState.enclosure,
            domeEnabled: true,
            domeMode: mode,
          },
        }))
      }
      {...props}
    />
  );
}

export function EcsDisableDome(props: ButtonProps) {
  return (
    <MutationButton
      mutation={ECS_DISABLE_DOME_MUTATION}
      variables={{}}
      update={(cache) =>
        updateTelescopeStateCache(cache, (telescopeState) => ({
          ...telescopeState,
          enclosure: {
            ...telescopeState.enclosure,
            domeEnabled: false,
          },
        }))
      }
      {...props}
    />
  );
}

export function EcsDomePark(props: ButtonProps) {
  return <MutationButton mutation={ECS_DOME_PARK_MUTATION} variables={{}} {...props} />;
}

export function EcsEnableShutters({
  mode,
  aperture,
  ...props
}: ButtonProps & { mode: ShutterControlMode | null; aperture: number | null }) {
  if (isNullish(mode)) return <Button {...props} disabled />;

  const input: ShutterModeInput = {
    mode,
    aperture: when(aperture, (meters) => ({ meters })) ?? null,
  };
  return (
    <MutationButton
      mutation={ECS_ENABLE_SHUTTERS_MUTATION}
      variables={{ mode: input }}
      update={(cache) =>
        updateTelescopeStateCache(cache, (telescopeState) => ({
          ...telescopeState,
          enclosure: {
            ...telescopeState.enclosure,
            shuttersMode: {
              ...telescopeState.enclosure.shuttersMode,
              __typename: 'ShutterMode',
              mode: mode,
              aperture:
                when(aperture, (meters) => ({
                  __typename: 'Distance',
                  meters,
                })) ?? null,
            },
            shuttersEnabled: true,
          },
        }))
      }
      {...props}
    />
  );
}

export function EcsDisableShutters(props: ButtonProps) {
  return (
    <MutationButton
      mutation={ECS_DISABLE_SHUTTERS_MUTATION}
      variables={{}}
      update={(cache) =>
        updateTelescopeStateCache(cache, (telescopeState) => ({
          ...telescopeState,
          enclosure: {
            ...telescopeState.enclosure,
            shuttersEnabled: false,
          },
        }))
      }
      {...props}
    />
  );
}

export function EcsShuttersPark(props: ButtonProps) {
  return <MutationButton mutation={ECS_SHUTTERS_PARK_MUTATION} variables={{}} {...props} />;
}

export function EcsMoveEastVentGate({ position, ...props }: ButtonProps & { position: number | null }) {
  if (isNullish(position)) return <Button {...props} disabled />;

  return (
    <MutationButton
      mutation={ECS_MOVE_EAST_VENT_GATE_MUTATION}
      variables={{ position }}
      update={(cache) =>
        updateTelescopeStateCache(cache, (telescopeState) => ({
          ...telescopeState,
          enclosure: {
            ...telescopeState.enclosure,
            eastVentGateAperture: position,
          },
        }))
      }
      {...props}
    />
  );
}

export function EcsCloseEastVentGate(props: ButtonProps) {
  return <MutationButton mutation={ECS_CLOSE_EAST_VENT_GATE_MUTATION} variables={{}} {...props} />;
}

export function EcsMoveWestVentGate({ position, ...props }: ButtonProps & { position: number | null }) {
  if (isNullish(position)) return <Button {...props} disabled />;

  return (
    <MutationButton
      mutation={ECS_MOVE_WEST_VENT_GATE_MUTATION}
      variables={{ position }}
      update={(cache) =>
        updateTelescopeStateCache(cache, (telescopeState) => ({
          ...telescopeState,
          enclosure: {
            ...telescopeState.enclosure,
            westVentGateAperture: position,
          },
        }))
      }
      {...props}
    />
  );
}

export function EcsCloseWestVentGate(props: ButtonProps) {
  return <MutationButton mutation={ECS_CLOSE_WEST_VENT_GATE_MUTATION} variables={{}} {...props} />;
}

// SLEW
export function Slew(props: ButtonProps) {
  const { data, loading: slewLoading } = useSlewFlags();
  const slewFlags = data?.slewFlags ?? ({} as SlewFlags);

  const { data: configData, loading: configLoading } = useConfiguration();
  const configuration = configData?.configuration;

  const { data: tcsConfig, loading: tcsConfigInputLoading, detail } = useTcsConfigInput();
  const loading = slewLoading || configLoading || tcsConfigInputLoading;

  if (detail) {
    return (
      <Button
        {...props}
        label={detail ? `${props.label ?? ''} (${detail})` : props.label}
        loading={loading}
        disabled={true}
      />
    );
  }

  const variables: RunSlewMutationVariables = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    slewOptions: (({ pk, __typename, ...o }) => o)(slewFlags),
    config: tcsConfig!,
    obsId: configuration?.obsId,
  };

  return (
    <MutationButton
      mutation={SLEW_MUTATION}
      variables={variables}
      {...props}
      loading={props.loading || loading}
      disabled={props.disabled}
    />
  );
}

/**
 *
 * @param state State of the subsystem
 * @param usedSubsystem If the subsystem is being used. Everything is always used, except the guiders (PWFS1, PWFS2, OIWFS, AOWFS), which are optional. Which one is used is given by the guide environment. But right now, we can use only OIWFS
 */
function classNameForState(
  state: MechSystemState | undefined,
  usedSubsystem: boolean,
): { classes: string; title: string; icons: ReactNode[] } {
  const title =
    (state?.follow === 'FOLLOWING' ? 'Following' : 'Not following') +
    ', ' +
    (state?.parked === 'PARKED' ? 'Parked' : 'Not parked') +
    ', ' +
    (usedSubsystem ? 'Used subsystem' : 'Not used subsystem');

  if (!state) return { classes: '', icons: [], title };

  const icons = [
    state.follow === 'FOLLOWING' ? (
      <Crosshairs width="16px" key="follow" />
    ) : (
      <CrosshairsSlash width="16px" key="follow" />
    ),
    state.parked === 'PARKED' ? <Parking width="16px" key="parked" /> : <ParkingSlash width="16px" key="parked" />,
  ];

  if (!usedSubsystem) {
    // Guiders not used: orange if following, grey otherwise
    return { classes: state.follow === 'FOLLOWING' ? BTN_CLASSES.ERROR : 'p-button-secondary', title, icons };
  } else if (state.follow === 'FOLLOWING' && state.parked === 'NOT_PARKED') {
    return { classes: '', title, icons };
  } else {
    return { classes: BTN_CLASSES.ACTIVE, title, icons };
  }
}

/**
 * Helper function to update the telescope state in the cache. Usually after a mutation.
 */
function updateTelescopeStateCache(
  cache: ApolloCache,
  updateTelescopeState: (state: TelescopeState) => TelescopeState,
) {
  return cache.updateQuery(
    {
      id: 'ROOT_QUERY',
      query: GET_TELESCOPE_STATE,
    },
    (data) =>
      when(data, (data) => ({
        ...data,
        telescopeState: updateTelescopeState(data.telescopeState),
      })),
  );
}
