import {useRef, useState, type JSX, type KeyboardEvent} from 'react';
import type {KeyBinding} from '@core/schema/shortcuts';
import {classNames} from './classNames';
import {shortcutPress} from './shortcutKeys';
import {shortcutRecordingProps} from './shortcutRecording';
import {TextField, type TextFieldProps} from './TextField';
import styles from './ShortcutField.module.css';

export interface ShortcutFieldProps extends Pick<
  TextFieldProps,
  | 'id'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-describedby'
  | 'className'
  | 'disabled'
  | 'autoFocus'
> {
  /** Receives one binding, or null when bare Backspace removes it. */
  readonly onRecord: (binding: KeyBinding | null) => void;
  /** Esc or focus leaving ends recording without changing the binding. */
  readonly onCancel: () => void;
}

/**
 * One recording session. Replace with KeyCombo when either callback runs.
 * Tab keeps its native focus traversal and cancels on the resulting blur.
 */
export function ShortcutField({
  onRecord,
  onCancel,
  autoFocus = true,
  className,
  ...rest
}: ShortcutFieldProps): JSX.Element {
  const recording = useRef(true);
  const altOnly = useRef(false);
  const [active, setActive] = useState(true);
  const [reason, setReason] = useState<string>();

  const finish = (input: HTMLInputElement, action: () => void): void => {
    recording.current = false;
    altOnly.current = false;
    setActive(false);
    input.blur();
    action();
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (!recording.current) return;
    const press = shortcutPress(event.nativeEvent);
    if (press.kind === 'tab') return;
    event.stopPropagation();
    event.preventDefault();
    if (event.repeat) return;
    altOnly.current =
      /^Alt(Left|Right)$/.test(event.code) &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.metaKey;
    switch (press.kind) {
      case 'modifier':
        return;
      case 'reject':
        setReason(press.reason);
        return;
      case 'cancel':
        finish(event.currentTarget, onCancel);
        return;
      case 'remove':
        finish(event.currentTarget, () => onRecord(null));
        return;
      case 'record':
        finish(event.currentTarget, () => onRecord(press.binding));
        return;
    }
  };

  return (
    <TextField
      {...rest}
      {...(active ? shortcutRecordingProps : {})}
      className={classNames(styles.field, className)}
      value=""
      onChange={() => undefined}
      size="sm"
      readOnly
      autoFocus={autoFocus}
      placeholder="키 입력"
      invalid={reason !== undefined}
      invalidReason={reason}
      onFocus={() => {
        recording.current = true;
        altOnly.current = false;
        setActive(true);
        setReason(undefined);
      }}
      onBlur={event => {
        if (recording.current) finish(event.currentTarget, onCancel);
      }}
      onKeyDown={keyDown}
      onKeyUp={event => {
        if (!recording.current) return;
        event.preventDefault();
        event.stopPropagation();
        if (altOnly.current && /^Alt(Left|Right)$/.test(event.code)) {
          setReason('메뉴 막대에 쓰는 키');
          altOnly.current = false;
        }
      }}
    />
  );
}
