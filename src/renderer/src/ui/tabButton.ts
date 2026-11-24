import type {ComponentPropsWithoutRef, KeyboardEvent, ReactNode} from 'react';
import {useButtonPress} from './press';
import {titleTooltip, useTooltip} from './Tooltip';

/**
 * What every tab button shares, in a panel header or on the toolbar: the tab
 * role, its tooltip, and the press that selects it on release.
 */
export function useTabButton({
  title,
  disabled,
  selected,
  onSelect,
  onKeyDown,
}: {
  readonly title: string | undefined;
  readonly disabled: boolean;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
}): {
  readonly props: ComponentPropsWithoutRef<'button'>;
  readonly tooltip: ReactNode;
} {
  const {targetProps, tooltip} = useTooltip(titleTooltip(title));
  const press = useButtonPress<HTMLButtonElement>({
    disabled,
    onPress: onSelect,
    onKeyDown,
    onBlur: targetProps.onBlur,
  });
  return {
    props: {
      ...targetProps,
      ...press,
      type: 'button',
      role: 'tab',
      'aria-selected': selected,
      'aria-disabled': disabled ? true : undefined,
    },
    tooltip,
  };
}
