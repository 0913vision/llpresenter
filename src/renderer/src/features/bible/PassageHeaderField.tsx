import type {JSX, KeyboardEvent} from 'react';
import {isComposing} from '@renderer/ui/fields/ime';
import {TextField} from '@renderer/ui/fields/TextField';
import styles from './BibleReferenceField.module.css';

/** Moves to the field after this one in the dialog, as Tab would. */
function focusNextField(input: HTMLInputElement): void {
  const dialog = input.closest('[role="dialog"]');
  if (dialog === null) return;
  const fields = [
    ...dialog.querySelectorAll<HTMLInputElement>('input:not([disabled])'),
  ];
  fields[fields.indexOf(input) + 1]?.focus();
}

/**
 * A one-line field on its own row above the passage, written straight on the
 * dialog like its book field: the same inset, icon and text size. Enter moves
 * on to the passage.
 */
export function PassageHeaderField({
  icon,
  label,
  value,
  maxLength,
  onChange,
}: {
  readonly icon: string;
  /** The field's name, shown faint while it is empty. */
  readonly label: string;
  readonly value: string;
  readonly maxLength: number;
  readonly onChange: (value: string) => void;
}): JSX.Element {
  const keys = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || isComposing(event)) return;
    event.preventDefault();
    event.stopPropagation();
    focusNextField(event.currentTarget);
  };
  return (
    <div className={styles.headerRow}>
      <div className={styles.headerField}>
        <TextField
          size="sm"
          block
          icon={icon}
          aria-label={label}
          placeholder={label}
          value={value}
          maxLength={maxLength}
          autoFocus
          onChange={onChange}
          onKeyDown={keys}
        />
      </div>
    </div>
  );
}
