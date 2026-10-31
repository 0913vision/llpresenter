import type {JSX} from 'react';
import {useRenameDraft} from '@renderer/ui/useRenameDraft';
import {Dialog, DialogField} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui/TextField';

const NAME_NEEDED = '이름을 적어야 바꿀 수 있습니다';

/** 이름 바꾸기 for a 템플릿 or a 예배 순서; the field starts with its name. */
export function RenameDialog({
  name,
  busy,
  onRename,
  onCancel,
}: {
  readonly name: string;
  readonly busy: boolean;
  readonly onRename: (name: string) => Promise<boolean>;
  readonly onCancel: () => void;
}): JSX.Element {
  const draft = useRenameDraft(
    name,
    {
      onCommit: onRename,
      onClose: onCancel,
      validate: value => (value === '' ? NAME_NEEDED : undefined),
    },
    busy,
  );
  return (
    <Dialog
      title="이름 바꾸기"
      subtitle={{text: name}}
      size="s"
      onCancel={draft.cancel}
      primary={{
        label: '바꾸기',
        onSelect: () => draft.commit(),
        disabled: draft.busy || !draft.valid,
        title: draft.problem,
      }}
    >
      <DialogField label="이름">
        <TextField {...draft.field} aria-label="이름" />
      </DialogField>
    </Dialog>
  );
}
