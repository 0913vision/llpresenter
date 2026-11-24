import type {JSX} from 'react';
import type {KeyBinding} from '@core/schema/app/shortcuts';
import {shortcutNames} from '@core/shortcuts';
import {KeyCombo, KeyList} from '@renderer/ui/keys/KeyCap';
import {ShortcutField} from '@renderer/ui/keys/ShortcutField';
import type {ShortcutRow} from './shortcutsModel';
import styles from './ShortcutsPage.module.css';

/** The key names of `binding`, as the key caps show them. */
export function keysOf(binding: KeyBinding): readonly string[] {
  return shortcutNames(binding);
}

function KeyCells({row}: {readonly row: ShortcutRow}): JSX.Element {
  const state =
    row.conflictWith !== undefined
      ? 'warning'
      : row.changed
        ? 'changed'
        : 'default';
  return (
    <KeyList>
      {row.bindings.map(binding => (
        <KeyCombo
          key={keysOf(binding).join('+')}
          keys={keysOf(binding)}
          state={state}
          conflictWith={row.conflictWith}
        />
      ))}
    </KeyList>
  );
}

/** One command in the 단축키 list: its name and its keys, or the key field while editing. */
export function CommandRow({
  row,
  selected,
  editing,
  locked,
  onSelect,
  onEdit,
  onRecord,
  onCancel,
}: {
  readonly row: ShortcutRow;
  readonly selected: boolean;
  readonly editing: boolean;
  readonly locked: boolean;
  readonly onSelect: () => void;
  readonly onEdit: () => void;
  readonly onRecord: (binding: KeyBinding | null) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      data-command={row.command.id}
      data-conflict={row.conflictWith === undefined ? undefined : 'true'}
      className={styles.row}
      onClick={onSelect}
      onDoubleClick={() => {
        if (!locked) onEdit();
      }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || event.key !== 'Enter') {
          return;
        }
        event.preventDefault();
        if (!locked) onEdit();
      }}
    >
      <span className={styles.name}>{row.command.name}</span>
      <span className={styles.keys}>
        {editing ? (
          <ShortcutField
            aria-label={`${row.command.name} 단축키`}
            onRecord={onRecord}
            onCancel={onCancel}
          />
        ) : (
          <KeyCells row={row} />
        )}
      </span>
    </div>
  );
}
