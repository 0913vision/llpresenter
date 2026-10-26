import {useState, type JSX, type KeyboardEvent} from 'react';
import type {Label} from '@shared/schema/labels';
import {Dialog} from '@renderer/ui/Dialog';
import {KeyCombo} from '@renderer/ui/KeyCap';
import {TextField} from '@renderer/ui/TextField';
import {isComposing} from '@renderer/ui/ime';
import {shortcutRecordingProps} from '@renderer/ui/shortcutRecording';
import type {SongEditorStore} from './songEditorStore';
import {editorTask} from './editorTask';

export const EMPTY_LABEL_NAME_REASON =
  '이름표 이름을 적어야 저장할 수 있습니다';
export const DUPLICATE_LABEL_NAME_REASON = '같은 이름의 이름표가 있습니다';
export const JUMP_KEY_REASON = '영문자나 숫자 키만 쓸 수 있습니다';

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
  readonly kind: 'rename' | 'key';
  readonly label: Label;
  readonly labels: readonly Label[];
  readonly store: SongEditorStore;
  readonly busy: boolean;
  readonly onClose: () => void;
}

/** Rename is main-owned across songs; jump keys are physical letters/digits. */
export function LabelDialog({
  kind,
  label,
  labels,
  store,
  busy,
  onClose,
}: LabelDialogProps): JSX.Element {
  const [name, setName] = useState(label.name);
  const [key, setKey] = useState(label.key);
  const [keyReason, setKeyReason] = useState<string>();
  const reason =
    kind === 'rename'
      ? labelNameReason(
          name,
          labels.filter(item => item.name !== label.name),
        )
      : keyReason;
  const conflict = labels.find(
    item => item.name !== label.name && item.key !== null && item.key === key,
  );
  const save = async (): Promise<void> => {
    if (busy || reason !== undefined) return;
    const saved =
      kind === 'rename'
        ? await store.renameLabel(label.name, name.trim())
        : await store.updateLabels(
            labels.map(item =>
              item.name === label.name ? {...item, key} : item,
            ),
          );
    if (saved) onClose();
  };
  const record = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (
      event.key === 'Tab' ||
      event.key === 'Escape' ||
      event.key === 'Enter'
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (busy || isComposing(event)) return;
    if (event.key === 'Backspace' || event.key === 'Delete') {
      setKey(null);
      setKeyReason(undefined);
      return;
    }
    let code = event.code;
    if (/^Numpad[0-9]$/.test(code) && event.getModifierState('NumLock')) {
      code = code.replace('Numpad', 'Digit');
    }
    if (
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      event.metaKey ||
      !/^(Key[A-Z]|Digit[0-9])$/.test(code)
    ) {
      setKeyReason(JUMP_KEY_REASON);
      return;
    }
    setKey(code);
    setKeyReason(undefined);
  };
  return (
    <Dialog
      title={kind === 'rename' ? '이름표 이름 바꾸기' : '이름표 바로 가기 키'}
      size="s"
      onCancel={onClose}
      primary={{
        label: '저장',
        onSelect: () => {
          editorTask(save());
        },
        disabled:
          busy ||
          reason !== undefined ||
          (kind === 'rename' && name.trim() === label.name),
        title:
          reason ??
          (busy
            ? '저장 중'
            : kind === 'rename' && name.trim() === label.name
              ? '같은 이름'
              : undefined),
      }}
    >
      {kind === 'rename' ? (
        <TextField
          aria-label="이름표 이름"
          value={name}
          onChange={setName}
          autoFocus
          block
          readOnly={busy}
          invalid={reason !== undefined}
          invalidReason={reason}
        />
      ) : (
        <>
          <TextField
            {...shortcutRecordingProps}
            aria-label="바로 가기 키"
            value={key?.replace(/^(Key|Digit)/, '') ?? ''}
            placeholder="없음"
            onChange={() => undefined}
            readOnly
            autoFocus
            block
            onKeyDown={record}
            onKeyUp={event => {
              if (event.key === 'Alt') {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            invalid={reason !== undefined}
            invalidReason={reason}
          />
          {conflict === undefined ? null : (
            <KeyCombo
              keys={key === null ? [] : [key.replace(/^(Key|Digit)/, '')]}
              state="warning"
              conflictWith={conflict.name}
            />
          )}
        </>
      )}
    </Dialog>
  );
}
