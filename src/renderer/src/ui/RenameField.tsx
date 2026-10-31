import type {JSX} from 'react';
import {TextField} from './TextField';
import {useRenameDraft, type RenameContract} from './useRenameDraft';

/** Edits a name in place with the shared save and cancellation contract. */
export function RenameField({
  name,
  label,
  rename,
  locked = false,
  maxLength,
}: {
  readonly name: string;
  readonly label: string;
  readonly rename: RenameContract;
  readonly locked?: boolean;
  readonly maxLength?: number;
}): JSX.Element {
  const draft = useRenameDraft(name, rename, locked);
  return (
    <TextField
      {...draft.field}
      aria-label={label}
      autoFocus
      maxLength={maxLength}
      onFocus={event => event.currentTarget.select()}
      onClick={event => event.stopPropagation()}
    />
  );
}
