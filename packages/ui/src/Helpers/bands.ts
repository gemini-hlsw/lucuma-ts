import type { Band } from '@gql/odb/gen/graphql';

import type { OdbBandBrightnessType, OdbSourceProfileType } from '@/types';

const BANDS: { odbName: Band; name: string; start: number; center: number; end: number }[] = [
  { odbName: 'SLOAN_U', name: 'u', start: 333000, center: 356000, end: 379000 },
  { odbName: 'SLOAN_G', name: 'g', start: 433000, center: 483000, end: 533000 },
  { odbName: 'SLOAN_R', name: 'r', start: 578000, center: 626000, end: 674000 },
  { odbName: 'SLOAN_I', name: 'i', start: 714000, center: 767000, end: 820000 },
  { odbName: 'SLOAN_Z', name: 'z', start: 847000, center: 910000, end: 973000 },
  { odbName: 'U', name: 'U', start: 322000, center: 360000, end: 398000 },
  { odbName: 'B', name: 'B', start: 395000, center: 440000, end: 485000 },
  { odbName: 'V', name: 'V', start: 507000, center: 550000, end: 593000 },
  { odbName: 'R', name: 'R', start: 620000, center: 670000, end: 720000 },
  { odbName: 'I', name: 'I', start: 820000, center: 870000, end: 920000 },
  { odbName: 'Y', name: 'Y', start: 960000, center: 1020000, end: 1080000 },
  { odbName: 'J', name: 'J', start: 1130000, center: 1250000, end: 1370000 },
  { odbName: 'H', name: 'H', start: 1500000, center: 1650000, end: 1800000 },
  { odbName: 'K', name: 'K', start: 1995000, center: 2200000, end: 2405000 },
  { odbName: 'L', name: 'L', start: 3410000, center: 3760000, end: 4110000 },
  { odbName: 'M', name: 'M', start: 4650000, center: 4770000, end: 4890000 },
  { odbName: 'N', name: 'N', start: 7855000, center: 10470000, end: 13085000 },
  { odbName: 'Q', name: 'Q', start: 19305000, center: 20130000, end: 20955000 },
  { odbName: 'AP', name: 'AP', start: 507000, center: 550000, end: 593000 },
  { odbName: 'GAIA', name: 'G', start: 330000, center: 641000, end: 1037000 },
  { odbName: 'GAIA_BP', name: 'G_BP', start: 328000, center: 513000, end: 671000 },
  { odbName: 'GAIA_RP', name: 'G_RP', start: 626000, center: 778000, end: 1051000 },
];

export function extractMagnitude(sourceProfile: OdbSourceProfileType | undefined) {
  if (!sourceProfile?.point?.bandNormalized?.brightnesses.length) return { name: undefined, value: undefined };

  const brightness =
    sourceProfile.point?.bandNormalized?.brightnesses.find((b) => b.band === 'GAIA') ??
    getBandClosestTo(sourceProfile.point?.bandNormalized?.brightnesses);

  if (!brightness) return { name: undefined, value: undefined };
  const name = BANDS.find((b) => b.odbName === brightness.band)?.name;
  const value = typeof brightness.value === 'string' ? parseFloat(brightness.value) : brightness.value;
  return { name, value };
}

function getBandClosestTo(brightnesses: readonly OdbBandBrightnessType[], wavelength = 600000) {
  BANDS.sort((a, b) => Math.abs(a.center - wavelength) - Math.abs(b.center - wavelength));
  for (const band of BANDS) {
    const brightness = brightnesses.find((b) => b.band === band.odbName);
    if (brightness) return brightness;
  }

  return undefined;
}
