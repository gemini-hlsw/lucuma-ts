/*
 * FontAwesome Pro (regular) icons wrapped as components, following
 * packages/ui's Icons.tsx — one named export per icon so call sites read as
 * `<Search />` and the icon set stays consistent across the GPP apps.
 */
import type { IconDefinition } from '@fortawesome/pro-regular-svg-icons';
import {
  faCheck,
  faCircle,
  faCircleCheck,
  faCircleDot,
  faCirclePlus,
  faCircleXmark,
  faCopy,
  faLock,
  faMagnifyingGlass,
  faPaperPlane,
  faPlus,
  faRightFromBracket,
  faRightToBracket,
  faSpinnerThird,
  faTriangleExclamation,
  faUpload,
  faXmark,
} from '@fortawesome/pro-regular-svg-icons';
import type { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const kebabToPascalCase = (str: string) =>
  str
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const iconFactory = (icon: IconDefinition) =>
  Object.assign(
    (props: Omit<FontAwesomeIconProps, 'icon'>) => {
      'use memo';
      return <FontAwesomeIcon {...props} icon={icon} />;
    },
    { displayName: kebabToPascalCase(icon.iconName) + 'Icon' },
  );

export const Check = iconFactory(faCheck);
export const Circle = iconFactory(faCircle);
export const CircleCheck = iconFactory(faCircleCheck);
export const CircleDot = iconFactory(faCircleDot);
export const CirclePlus = iconFactory(faCirclePlus);
export const CircleXMark = iconFactory(faCircleXmark);
export const Copy = iconFactory(faCopy);
export const Lock = iconFactory(faLock);
export const PaperPlane = iconFactory(faPaperPlane);
export const Plus = iconFactory(faPlus);
export const Search = iconFactory(faMagnifyingGlass);
export const SignIn = iconFactory(faRightToBracket);
export const SignOut = iconFactory(faRightFromBracket);
export const Spinner = iconFactory(faSpinnerThird);
export const TriangleExclamation = iconFactory(faTriangleExclamation);
export const Upload = iconFactory(faUpload);
export const XMark = iconFactory(faXmark);
