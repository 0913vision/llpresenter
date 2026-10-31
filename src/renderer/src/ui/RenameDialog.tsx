import type {JSX} from 'react';
import {Dialog} from './Dialog';
import {TextField} from './TextField';
import {useRenameDraft, type RenameContract} from './useRenameDraft';

/** Presents the shared rename lifecycle with feature-owned validation and saving. */
export function RenameDialog({
  name,
  title,
  label = '이름',
  locked = false,
  maxLength,
  rename,
  subtitle,
}: {
  readonly name: string;
  readonly title: string;
  readonly label?: string;
  readonly locked?: boolean;
  readonly maxLength?: number;
  readonly subtitle?: string;
  readonly rename: RenameContract;
}): JSX.Element {
  const draft = useRenameDraft(name, rename, locked);
  return (
    <Dialog
      title={title}
      size="s"
      subtitle={subtitle === undefined ? undefined : {text: subtitle}}
      onCancel={draft.cancel}
      primary={{
        label: '저장',
        disabled: draft.busy || !draft.valid,
        title: draft.problem,
        onSelect: () => draft.commit(),
      }}
    >
      <TextField
        {...draft.field}
        aria-label={label}
        autoFocus
        block
        maxLength={maxLength}
        onFocus={event => event.currentTarget.select()}
      />
    </Dialog>
  );
}
