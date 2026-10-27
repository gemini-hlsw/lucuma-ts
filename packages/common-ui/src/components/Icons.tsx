import type { IconDefinition } from '@fortawesome/pro-regular-svg-icons';
import {
  faArrowRightFromBracket,
  faBars,
  faCaretDown,
  faCaretLeft,
  faCaretRight,
  faCaretUp,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircle,
  faCircleCheck,
  faCircleDot,
  faCircleInfo,
  faCirclePlus,
  faCircleXmark,
  faClockRotateLeft,
  faCopy,
  faFloppyDisk,
  faGear,
  faLayerGroup,
  faList,
  faLocationCrosshairs,
  faLocationCrosshairsSlash,
  faLock,
  faMagnifyingGlass,
  faMap,
  faMoon,
  faPaperPlane,
  faPlay,
  faPlus,
  faRightFromBracket,
  faRightToBracket,
  faRotate,
  faRotateRight,
  faSliders,
  faSpinnerThird,
  faSquareParking,
  faSquareParkingSlash,
  faStop,
  faSun,
  faTrashXmark,
  faTriangleExclamation,
  faUpload,
  faUser,
  faUserAstronaut,
  faVolume,
  faVolumeSlash,
  faXmark,
} from '@fortawesome/pro-regular-svg-icons';
import type { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const kebabToPascalCase = (str: string) =>
  str
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

/** Wraps a FontAwesome icon. Sets its `displayName` to `<PascalCase>Icon`. */
export const iconFactory = (icon: IconDefinition) =>
  Object.assign(
    (props: Omit<FontAwesomeIconProps, 'icon'>) => {
      'use memo';
      return <FontAwesomeIcon {...props} icon={icon} />;
    },
    { displayName: kebabToPascalCase(icon.iconName) + 'Icon' },
  );

export const ArrowRightFromBracket = iconFactory(faArrowRightFromBracket);
export const Astronaut = iconFactory(faUserAstronaut);
export const Bars = iconFactory(faBars);
export const CaretDown = iconFactory(faCaretDown);
export const CaretLeft = iconFactory(faCaretLeft);
export const CaretRight = iconFactory(faCaretRight);
export const CaretUp = iconFactory(faCaretUp);
export const Check = iconFactory(faCheck);
export const ChevronDown = iconFactory(faChevronDown);
export const ChevronLeft = iconFactory(faChevronLeft);
export const ChevronRight = iconFactory(faChevronRight);
export const ChevronUp = iconFactory(faChevronUp);
export const Circle = iconFactory(faCircle);
export const CircleCheck = iconFactory(faCircleCheck);
export const CircleDot = iconFactory(faCircleDot);
export const CirclePlus = iconFactory(faCirclePlus);
export const CircleXMark = iconFactory(faCircleXmark);
export const ClockRotateLeft = iconFactory(faClockRotateLeft);
export const Copy = iconFactory(faCopy);
export const Crosshairs = iconFactory(faLocationCrosshairs);
export const CrosshairsSlash = iconFactory(faLocationCrosshairsSlash);
export const FloppyDisk = iconFactory(faFloppyDisk);
export const Gear = iconFactory(faGear);
export const Info = iconFactory(faCircleInfo);
export const LayerGroup = iconFactory(faLayerGroup);
export const List = iconFactory(faList);
export const Lock = iconFactory(faLock);
export const Map = iconFactory(faMap);
export const Moon = iconFactory(faMoon);
export const PaperPlane = iconFactory(faPaperPlane);
export const Parking = iconFactory(faSquareParking);
export const ParkingSlash = iconFactory(faSquareParkingSlash);
export const Play = iconFactory(faPlay);
export const Plus = iconFactory(faPlus);
export const Rotate = iconFactory(faRotate);
export const RotateRight = iconFactory(faRotateRight);
export const Search = iconFactory(faMagnifyingGlass);
export const SignIn = iconFactory(faRightToBracket);
export const SignOut = iconFactory(faRightFromBracket);
export const Sliders = iconFactory(faSliders);
export const Spinner = iconFactory(faSpinnerThird);
export const Stop = iconFactory(faStop);
export const Sun = iconFactory(faSun);
export const Trash = iconFactory(faTrashXmark);
export const TriangleExclamation = iconFactory(faTriangleExclamation);
export const Upload = iconFactory(faUpload);
export const UserIcon = iconFactory(faUser);
export const Volume = iconFactory(faVolume);
export const VolumeSlash = iconFactory(faVolumeSlash);
export const XMark = iconFactory(faXmark);
