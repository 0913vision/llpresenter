import {useState, type JSX} from 'react';
import type {Label} from '@core/schema/labels';
import {Dialog} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui/TextField';
import type {SongEditorStore} from './songEditorStore';
import {editorTask} from './editorTask';

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
  const [name, setName] = useState(label.name);
  const reason = labelNameReason(
    name,
    labels.filter(item => item.name !== label.name),
  );
  const unchanged = name.trim() === label.name;
  const unavailableReason =
    reason ?? (busy ? '저장 중' : unchanged ? '같은 이름' : undefined);
  const save = async (): Promise<void> => {
    if (busy || reason !== undefined || unchanged) return;
    if (await store.renameLabel(label.name, name.trim())) onClose();
  };
  return (
    <Dialog
      title="이름표 이름 바꾸기"
      subtitle={{text: label.name}}
      size="s"
      onCancel={onClose}
      primary={{
        label: '저장',
        onSelect: () => editorTask(save()),
        disabled: busy || reason !== undefined || unchanged,
        title: unavailableReason ?? LABEL_RENAME_SCOPE,
      }}
    >
      <TextField
        aria-label="이름표 이름"
        title={LABEL_RENAME_SCOPE}
        value={name}
        onChange={setName}
        autoFocus
        block
        readOnly={busy}
        invalid={reason !== undefined}
        invalidReason={reason}
      />
    </Dialog>
  );
}
