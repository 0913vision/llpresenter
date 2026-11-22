import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type JSX,
} from 'react';
import {TYPING_PAUSE_MS} from '@core/songs/songHistory';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {
  NEWER_FILE_REASON,
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {TextArea} from '@renderer/ui/TextArea';
import {TextField} from '@renderer/ui';
import type {ServiceItemStore} from './serviceItemStore';
import styles from './ItemTextField.module.css';

/** Edits one text of a service item where it is kept, saving at each pause. */
export function ItemTextField({
  label,
  value,
  items,
  readOnly,
  maxLength = 4000,
  placeholder,
  singleLine = false,
  save,
}: {
  readonly label: string;
  readonly value: string;
  readonly items: ServiceItemStore;
  readonly readOnly: boolean;
  readonly maxLength?: number;
  /** What shows while the field is empty. */
  readonly placeholder?: string | undefined;
  readonly singleLine?: boolean;
  readonly save: (text: string) => Promise<boolean>;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const fieldId = useId();
  const pending = useRef<string | null>(null);
  const saving = useRef<Promise<boolean> | null>(null);
  const replaying = useRef(false);
  const flush = (): Promise<boolean> | null => {
    const text = pending.current;
    if (text === null) return saving.current;
    pending.current = null;
    const request = save(text).then(ok => {
      if (saving.current === request) saving.current = null;
      if (ok) setDraft(current => (current === text ? null : current));
      else pending.current ??= text;
      return ok;
    });
    saving.current = request;
    return request;
  };
  const saveDraft = (): void => {
    const request = flush();
    if (request !== null) editorTask(request);
  };
  const flushIdle = useEffectEvent(saveDraft);
  useEffect(() => {
    if (draft === null) return;
    const timer = setTimeout(() => flushIdle(), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => () => flushIdle(), []);

  const ownsHistory = (event: KeyboardEvent): boolean =>
    event.target instanceof Element &&
    event.target
      .closest('[data-slide-box-text]')
      ?.getAttribute('data-slide-box-text') === fieldId;
  const unavailable = (action: 'undo' | 'redo'): string | undefined => {
    if (readOnly) return NEWER_FILE_REASON;
    if (draft !== null) return action === 'undo' ? undefined : NOTHING_TO_REDO;
    if (items.canUndoItemEdit(action)) return undefined;
    return action === 'undo' ? NOTHING_TO_UNDO : NOTHING_TO_REDO;
  };
  const replay = async (action: 'undo' | 'redo'): Promise<void> => {
    if (
      readOnly ||
      replaying.current ||
      (action === 'redo' && draft !== null)
    ) {
      return;
    }
    replaying.current = true;
    try {
      const request = flush();
      if (request === null || (await request)) {
        await items.replayItemEdit(action);
      }
    } finally {
      replaying.current = false;
    }
  };
  useWindowShortcuts([
    {
      id: 'edit.undo',
      context: 'song',
      when: ownsHistory,
      unavailable: () => unavailable('undo'),
      run: () => replay('undo'),
    },
    {
      id: 'edit.redo',
      context: 'song',
      when: ownsHistory,
      unavailable: () => unavailable('redo'),
      run: () => replay('redo'),
    },
  ]);
  const field = {
    'aria-label': label,
    'data-slide-box-text': fieldId,
    maxLength,
    placeholder,
    readOnly,
    value: draft ?? value,
    onChange: (text: string) => {
      pending.current = text;
      setDraft(text);
    },
    onBlur: saveDraft,
  };
  return (
    <label className={styles.field}>
      {label}
      {singleLine ? <TextField {...field} /> : <TextArea {...field} />}
    </label>
  );
}
