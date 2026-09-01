/* One named export per icon, following packages/ui's Icons.tsx. */
import type { IconDefinition } from '@fortawesome/pro-regular-svg-icons';
import { faChevronLeft, faChevronRight } from '@fortawesome/pro-regular-svg-icons';
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

export const ChevronLeft = iconFactory(faChevronLeft);
export const ChevronRight = iconFactory(faChevronRight);
