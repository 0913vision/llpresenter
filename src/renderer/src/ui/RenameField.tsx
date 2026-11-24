import type {JSX} from 'react';
import {TextField} from './TextField';
import {useRenameDraft, type RenameContract} from './useRenameDraft';

/** Edits a name in place with the shared save and cancellation contract. */
export function RenameField({
  name,
  label,
  rename,
  locked = false,
}: {
  readonly name: string;
  readonly label: string;
  readonly rename: RenameContract;
  readonly locked?: boolean;
}): JSX.Element {
  const draft = useRenameDraft(name, rename, locked);
  return (
    <TextField
      {...draft.field}
      aria-label={label}
      autoFocus
      onFocus={event => event.currentTarget.select()}
      onClick={event => event.stopPropagation()}
    />
  );
}
