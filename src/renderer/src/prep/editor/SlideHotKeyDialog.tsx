import {useRef, useState, type JSX, type KeyboardEvent} from 'react';
import {Dialog} from '@renderer/ui/Dialog';
import {KeyCombo} from '@renderer/ui/KeyCap';
import {TextField} from '@renderer/ui/TextField';
import {shortcutRecordingProps} from '@renderer/ui/shortcutRecording';
import {slideHotKeyPress, SLIDE_HOT_KEY_REASON} from './slideHotKeyPress';

export interface SlideHotKeyAssignment {
  readonly code: string;
  readonly slideNumber: number;
}

/** A source slide's key editor; the owner commits through its normal song writer. */
export function SlideHotKeyDialog({
  value,
  slideNumber,
  otherAssignments,
  disabledReason,
  onSave,
  onClose,
}: {
  readonly value: string | undefined;
  readonly slideNumber: number;
  readonly otherAssignments: readonly SlideHotKeyAssignment[];
  readonly disabledReason?: string | undefined;
  readonly onSave: (code: string | undefined) => boolean;
  readonly onClose: () => void;
}): JSX.Element {
  const [code, setCode] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const composing = useRef(false);
  const conflict =
    code === undefined
      ? undefined
      : otherAssignments.find(item => item.code === code);
  const reason =
    disabledReason ??
    (invalid
      ? SLIDE_HOT_KEY_REASON
      : conflict === undefined
        ? undefined
        : `슬라이드 ${conflict.slideNumber}에서 쓰는 키입니다`);
  const record = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (composing.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const press = slideHotKeyPress(event.nativeEvent);
    if (press.kind === 'pass') return;
    event.preventDefault();
    event.stopPropagation();
    if (disabledReason !== undefined || press.kind === 'ignore') return;
    setInvalid(press.kind === 'reject');
    if (press.kind === 'remove') setCode(undefined);
    if (press.kind === 'record') setCode(press.code);
  };
  return (
    <Dialog
      title="슬라이드 바로 가기 키"
      subtitle={{text: `슬라이드 ${slideNumber}`, icon: 'slides'}}
      size="s"
      onCancel={onClose}
      secondary={[
        {
          label: '지우기',
          disabled: disabledReason !== undefined || code === undefined,
          title: disabledReason,
          onSelect: () => {
            if (disabledReason === undefined) {
              setCode(undefined);
              setInvalid(false);
            }
          },
        },
      ]}
      primary={{
        label: '저장',
        disabled: reason !== undefined || code === value,
        title: reason ?? (code === value ? '같은 바로 가기 키' : undefined),
        onSelect: () => {
          if (reason === undefined && code !== value && onSave(code)) onClose();
        },
      }}
    >
      <TextField
        {...shortcutRecordingProps}
        aria-label="슬라이드 바로 가기 키"
        value={code?.replace(/^(Key|Digit)/, '') ?? ''}
        placeholder="없음"
        onChange={() => undefined}
        readOnly
        autoFocus
        block
        aria-disabled={disabledReason !== undefined ? true : undefined}
        title={disabledReason}
        invalid={disabledReason === undefined && reason !== undefined}
        invalidReason={reason}
        onKeyDown={record}
        onKeyUp={event => {
          if (event.key === 'Alt') {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onBlur={() => {
          composing.current = false;
        }}
      />
      {conflict === undefined ? null : (
        <KeyCombo
          keys={code === undefined ? [] : [code.replace(/^(Key|Digit)/, '')]}
          state="warning"
          conflictWith={`슬라이드 ${conflict.slideNumber}`}
        />
      )}
    </Dialog>
  );
}
