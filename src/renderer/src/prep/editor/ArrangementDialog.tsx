import {useState, type JSX} from 'react';
import {DEFAULT_ARRANGEMENT_NAME} from '@shared/schema/song';
import {Dialog} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui/TextField';
import {editorTask} from './editorTask';
import type {SongEditorStore} from './songEditorStore';

/** Validates the exact trimmed names used by main's arrangement commands. */
export function arrangementNameReason(
  value: string,
  names: readonly string[],
  from: string,
): string | undefined {
  const name = value.trim();
  if (name === '') return '이름을 입력하세요';
  if (name === DEFAULT_ARRANGEMENT_NAME) {
    return '기본 구성의 이름은 사용할 수 없습니다';
  }
  if (!names.includes(from)) return '구성을 찾을 수 없습니다';
  if (name !== from && names.includes(name)) return '이미 있는 구성';
  return undefined;
}

export function ArrangementDialog({
  name,
  names,
  store,
  locked,
  onClose,
}: {
  readonly name: string;
  readonly names: readonly string[];
  readonly store: SongEditorStore;
  readonly locked: boolean;
  readonly onClose: () => void;
}): JSX.Element {
  const [value, setValue] = useState(name);
  const reason = arrangementNameReason(value, names, name);
  const save = async (): Promise<void> => {
    if (locked || reason !== undefined) return;
    if (
      value.trim() === name ||
      (await store.renameArrangement(name, value.trim()))
    ) {
      onClose();
    }
  };
  return (
    <Dialog
      title="구성 이름 바꾸기"
      size="s"
      onCancel={onClose}
      primary={{
        label: '저장',
        disabled: locked || reason !== undefined,
        title: reason ?? (locked ? '변경할 수 없는 곡' : undefined),
        onSelect: () => editorTask(save()),
      }}
    >
      <TextField
        aria-label="구성 이름"
        value={value}
        onChange={setValue}
        autoFocus
        block
        onFocus={event => event.currentTarget.select()}
        readOnly={locked}
        invalid={reason !== undefined}
        invalidReason={reason}
      />
    </Dialog>
  );
}
