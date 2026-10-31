import {useState, type JSX} from 'react';
import {useRenameDraft} from '@renderer/ui/useRenameDraft';
import {DEFAULT_ARRANGEMENT_NAME} from '@core/schema/song';
import {Dialog} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui/TextField';
import type {AppliedRename, SongEditorStore} from './songEditorStore';

export const EMPTY_ARRANGEMENT_NAME_REASON =
  '구성 이름을 적어야 저장할 수 있습니다';
export const RESERVED_ARRANGEMENT_NAME_REASON =
  '기본 구성의 이름은 쓸 수 없습니다';
export const MISSING_ARRANGEMENT_REASON = '구성을 찾을 수 없습니다';
export const DUPLICATE_ARRANGEMENT_NAME_REASON =
  '이 곡에 같은 이름의 구성이 있습니다';

/** Validates the exact trimmed names used by main's arrangement commands. */
export function arrangementNameReason(
  value: string,
  names: readonly string[],
  from: string,
): string | undefined {
  const name = value.trim();
  if (name === '') return EMPTY_ARRANGEMENT_NAME_REASON;
  if (name === DEFAULT_ARRANGEMENT_NAME) {
    return RESERVED_ARRANGEMENT_NAME_REASON;
  }
  if (!names.includes(from)) return MISSING_ARRANGEMENT_REASON;
  if (name !== from && names.includes(name)) {
    return DUPLICATE_ARRANGEMENT_NAME_REASON;
  }
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
  const [applied, setApplied] = useState<AppliedRename | null>(null);
  const currentName = applied?.name ?? name;
  const draft = useRenameDraft(
    name,
    {
      validate: value => arrangementNameReason(value, names, currentName),
      onCommit: value =>
        applied !== null && value === applied.name
          ? store.retryRename(applied)
          : store.renameArrangement(currentName, value, setApplied),
      onClose: onClose,
    },
    locked,
  );
  return (
    <Dialog
      title="구성 이름 바꾸기"
      size="s"
      onCancel={draft.cancel}
      primary={{
        label: '저장',
        disabled: draft.busy || !draft.valid,
        title: draft.problem ?? (locked ? '변경할 수 없는 곡' : undefined),
        onSelect: () => draft.commit(),
      }}
    >
      <TextField
        aria-label="구성 이름"
        {...draft.field}
        autoFocus
        block
        onFocus={event => event.currentTarget.select()}
      />
    </Dialog>
  );
}
