import type {JSX} from 'react';
import {Button} from '@renderer/ui/Button';
import type {OwnText} from './useOwnText';

/** Opens a value that fills itself for editing, or puts its default back. */
export function OwnTextButton({
  own: {on, disabled, set},
}: {
  readonly own: OwnText;
}): JSX.Element {
  return (
    <Button variant="ghost" disabled={disabled} onClick={() => set(!on)}>
      {on ? '기본값으로' : '편집'}
    </Button>
  );
}
