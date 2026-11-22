import type {JSX} from 'react';
import {IconButton} from '@renderer/ui/IconButton';
import type {OwnText} from './useOwnText';

/** Opens a value that fills itself for editing, or puts its default back. */
export function OwnTextButton({
  own: {on, disabled, set},
}: {
  readonly own: OwnText;
}): JSX.Element {
  return (
    <IconButton
      icon="edit"
      label={on ? '기본값으로' : '편집'}
      pressed={on}
      disabled={disabled}
      onPressedChange={set}
    />
  );
}
