import { when } from '@gemini-hlsw/lucuma-common-ui';
import type { GuideProbe, HandsetAdjustmentInput } from '@gql/server/gen/graphql';

import type { Alignment } from './Controls';

export interface Coords {
  horizontal: number;
  vertical: number;
}

type CoordsMod = (step: number) => Coords;

const minusVertical: CoordsMod = (step) => ({
  horizontal: 0,
  vertical: -step,
});
const plusHorizontal: CoordsMod = (step) => ({
  horizontal: step,
  vertical: 0,
});
const minusHorizontal: CoordsMod = (step) => ({
  horizontal: -step,
  vertical: 0,
});
const plusVertical: CoordsMod = (step) => ({
  horizontal: 0,
  vertical: step,
});

interface LabelledCoordsMod {
  label: string | undefined;
  mod: CoordsMod;
}

/**
 * How to handle handset adjustments for different coordinate systems.
 */
export interface HandsetStrategy {
  name: Alignment;
  up: LabelledCoordsMod;
  down: LabelledCoordsMod;
  right: LabelledCoordsMod;
  left: LabelledCoordsMod;
  horizontal: string;
  vertical: string;
  toInput: (coords: Coords, angleDegrees: number | undefined | null) => HandsetAdjustmentInput;
}

/**
 * Different coordinate systems handle up, down, left, and right movements differently. This object defines a strategy for each.
 * Each strategy has up, down, left, and right movements, as well as horizontal and vertical adjustments. These are then 'translated' into El, Dec, Az, etc.
 */
export const strategies = {
  'Az/El': {
    name: 'Az/El',
    up: { label: '+El', mod: plusVertical },
    down: { label: '-El', mod: minusVertical },
    right: { label: '+Az', mod: plusHorizontal },
    left: { label: '-Az', mod: minusHorizontal },
    horizontal: 'Az',
    vertical: 'El',
    toInput: (coords: Coords) => ({
      horizontalAdjustment: {
        elevation: { arcseconds: coords.vertical },
        azimuth: { arcseconds: coords.horizontal },
      },
    }),
  },
  AC: {
    name: 'AC',
    up: { label: '-X', mod: minusHorizontal },
    down: { label: '+X', mod: plusHorizontal },
    right: { label: '+Y', mod: plusVertical },
    left: { label: '-Y', mod: minusVertical },
    horizontal: 'X',
    vertical: 'Y',
    toInput: (coords: Coords) => ({
      focalPlaneAdjustment: {
        deltaX: { arcseconds: coords.horizontal },
        deltaY: { arcseconds: coords.vertical },
      },
    }),
  },
  Instrument: {
    name: 'Instrument',
    up: { label: '-Q', mod: minusVertical },
    down: { label: '+Q', mod: plusVertical },
    right: { label: '+P', mod: plusHorizontal },
    left: { label: '-P', mod: minusHorizontal },
    horizontal: 'P',
    vertical: 'Q',
    toInput: (coords: Coords) => ({
      instrumentAdjustment: {
        q: { arcseconds: coords.vertical },
        p: { arcseconds: coords.horizontal },
      },
    }),
  },
  'RA/Dec': {
    name: 'RA/Dec',
    up: { label: 'N', mod: plusVertical },
    down: { label: 'S', mod: minusVertical },
    right: { label: 'W', mod: plusHorizontal },
    left: { label: 'E', mod: minusHorizontal },
    horizontal: 'RA',
    vertical: 'Dec',
    toInput: (coords: Coords) => ({
      equatorialAdjustment: {
        deltaDec: { arcseconds: coords.vertical },
        deltaRA: { arcseconds: coords.horizontal },
      },
    }),
  },
  PWFS1: wfsStrategy('PWFS1'),
  PWFS2: wfsStrategy('PWFS2'),
  OIWFS: wfsStrategy('GMOS_OIWFS'),
} satisfies Record<Alignment, HandsetStrategy>;

export function wfsStrategy(probe: GuideProbe): HandsetStrategy {
  return {
    name: probe === 'GMOS_OIWFS' || probe === 'FLAMINGOS2_OIWFS' ? 'OIWFS' : probe,
    up: { label: undefined, mod: plusVertical },
    down: { label: undefined, mod: minusVertical },
    right: { label: undefined, mod: plusHorizontal },
    left: { label: undefined, mod: minusHorizontal },
    horizontal: 'u',
    vertical: 'v',
    toInput: (coords, angleDegrees) => ({
      probeFrameAdjustment: {
        probeFrame: probe,
        deltaV: { arcseconds: coords.vertical },
        deltaU: { arcseconds: coords.horizontal },
        alignAngle: when(angleDegrees, (degrees) => ({ degrees })),
      },
    }),
  };
}
