import {useState, type JSX} from 'react';
import {useRenameDraft} from '@renderer/ui/useRenameDraft';
import type {Label} from '@core/schema/labels';
import {Dialog} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui/TextField';
import type {AppliedRename, SongEditorStore} from './songEditorStore';

export const EMPTY_LABEL_NAME_REASON =
  '이름표 이름을 적어야 저장할 수 있습니다';
export const DUPLICATE_LABEL_NAME_REASON = '같은 이름의 이름표가 있습니다';
export const LABEL_RENAME_SCOPE = '모든 곡에서 이 이름표의 이름을 바꿉니다';

/** The labels file stores unique, nonblank names without trimming old names. */
export function labelNameReason(
  name: string,
  labels: readonly Label[],
): string | undefined {
  if (name.trim() === '') return EMPTY_LABEL_NAME_REASON;
  if (labels.some(label => label.name === name.trim())) {
    return DUPLICATE_LABEL_NAME_REASON;
  }
  return undefined;
}

interface LabelDialogProps {
  readonly label: Label;
  readonly labels: readonly Label[];
  readonly store: SongEditorStore;
  readonly busy: boolean;
  readonly onClose: () => void;
}

/** Renames the shared label across the library through main. */
export function LabelDialog({
  label,
  labels,
  store,
  busy,
  onClose,
}: LabelDialogProps): JSX.Element {
  const [applied, setApplied] = useState<AppliedRename | null>(null);
  const currentName = applied?.name ?? label.name;
  const draft = useRenameDraft(
    label.name,
    {
      validate: name =>
        labelNameReason(
          name,
          labels.filter(item => item.name !== currentName),
        ),
      onCommit: name =>
        applied !== null && name === applied.name
          ? store.retryRename(applied)
          : store.renameLabel(currentName, name, setApplied),
      onClose: onClose,
    },
    busy,
  );
  return (
    <Dialog
      title="이름표 이름 바꾸기"
      subtitle={{text: label.name}}
      size="s"
      onCancel={draft.cancel}
      primary={{
        label: '저장',
        onSelect: () => draft.commit(),
        disabled: draft.busy || !draft.valid,
        title: draft.problem ?? LABEL_RENAME_SCOPE,
      }}
    >
      <TextField
        aria-label="이름표 이름"
        title={LABEL_RENAME_SCOPE}
        {...draft.field}
        autoFocus
        block
      />
    </Dialog>
  );
}
