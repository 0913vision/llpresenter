import {useEffect, useRef, useState, type JSX} from 'react';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {CellButton} from './CellButton';
import styles from './ServiceTable.module.css';

// NOTE(0913vision): Keys the row and the list would take for their own:
// Space selects the row, the arrows and Home and End move between rows. The
// field keeps them, and with them its own behavior. F1 to F6 and shortcuts
// still reach the window.
const LIST_KEYS: ReadonlySet<string> = new Set([
  ' ',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

/**
 * The 메모 of an item row. It edits as text in the cell: Enter or leaving the
 * cell saves, Esc puts the saved text back. The typed text stays in the field
 * until the save works, so a refused save loses nothing.
 */
export function MemoCell({
  label,
  memo,
  reason,
  save,
}: {
  /** The accessible name, which names the row as well. */
  readonly label: string;
  readonly memo: string;
  readonly reason: string | undefined;
  /** Resolves true when the memo was saved. */
  readonly save: (memo: string) => Promise<boolean>;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const returnFocus = useRef(false);
  // NOTE(0913vision): Chromium may blur the input while it unmounts, after
  // the edit has ended; the flag keeps that blur from saving again.
  const done = useRef(false);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const editing = draft !== null;
  useEffect(() => {
    if (!editing) {
      if (returnFocus.current) {
        returnFocus.current = false;
        button.current?.focus();
      }
      return;
    }
    field.current?.focus();
    field.current?.select();
  }, [editing]);
  if (draft === null) {
    return (
      <CellButton
        label={label}
        width={styles.memo}
        dim={false}
        reason={reason}
        expanded={false}
        popup={undefined}
        buttonRef={button}
        onOpen={() => {
          done.current = false;
          setDraft(memo);
        }}
      >
        {memo}
      </CellButton>
    );
  }
  const end = (focus: boolean): void => {
    done.current = true;
    returnFocus.current = focus;
    setDraft(null);
  };
  const commit = (focus: boolean): void => {
    if (done.current || saving.current) return;
    if (draft === memo) {
      end(focus);
      return;
    }
    saving.current = true;
    setBusy(true);
    save(draft)
      .catch(() => false)
      .then(saved => {
        saving.current = false;
        setBusy(false);
        if (saved) end(focus);
      })
      .catch(() => undefined);
  };
  return (
    <input
      ref={field}
      className={styles.memoField}
      aria-label={label}
      value={draft}
      readOnly={busy}
      onChange={event => setDraft(event.currentTarget.value)}
      onBlur={() => commit(false)}
      onKeyDown={event => {
        if (isComposing(event)) return;
        if (!hasModifier(event) && event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          commit(true);
        } else if (!hasModifier(event) && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          // NOTE(0913vision): The field stays open until a waiting save
          // settles, so a reopened field never meets an older save.
          if (!saving.current) end(true);
        } else if (LIST_KEYS.has(event.key)) {
          event.stopPropagation();
        }
      }}
    />
  );
}
