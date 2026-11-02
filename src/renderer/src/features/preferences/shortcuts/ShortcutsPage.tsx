import {useEffect, useMemo, useRef, useState, type JSX} from 'react';
import type {KeyBinding} from '@core/schema/shortcuts';
import {shortcutNames} from '@core/shortcuts/keys';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {Button} from '@renderer/ui/Button';
import {KeyCombo, KeyList} from '@renderer/ui/KeyCap';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {ShortcutField} from '@renderer/ui/ShortcutField';
import {TextField} from '@renderer/ui/TextField';
import type {Notice} from '@renderer/ui/notices';
import {
  buildRows,
  filterRows,
  groupRows,
  shortcutCounts,
  type ShortcutFilter,
  type ShortcutRow,
} from './shortcutsModel';
import {useShortcutEdits} from './useShortcutEdits';
import styles from './ShortcutsPage.module.css';

const NO_DEFAULT = '기본값 없음';
const LIST_LABEL = '명령';

function keysOf(binding: KeyBinding): readonly string[] {
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

function CommandRow({
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

// TODO(0913vision): Virtualize the rows if the objects can grow without a cap.
/** 단축키: every command with its keys, and the editing of one. */
export function ShortcutsPage({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const edits = useShortcutEdits(onProblem);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ShortcutFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () => buildRows(edits.commands, edits.overrides),
    [edits.commands, edits.overrides],
  );
  const counts = shortcutCounts(rows);
  const shown = filterRows(rows, query, filter);
  const groups = groupRows(shown);
  const selected = rows.find(row => row.command.id === selectedId);
  const locked = edits.lockedReason !== undefined;
  useEffect(() => {
    if (editingId !== null) return;
    const active = list.current?.ownerDocument.activeElement;
    if (active === document.body) {
      list.current
        ?.querySelector<HTMLElement>(`[data-command="${selectedId}"]`)
        ?.focus();
    }
  }, [editingId, selectedId]);
  const moveSelection = (step: 1 | -1): void => {
    const at = shown.findIndex(row => row.command.id === selectedId);
    const next = shown[Math.max(0, Math.min(shown.length - 1, at + step))];
    if (next === undefined) return;
    setSelectedId(next.command.id);
    list.current
      ?.querySelector<HTMLElement>(`[data-command="${next.command.id}"]`)
      ?.focus();
  };
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>단축키</h1>
        <Button
          icon="undo"
          disabled={locked}
          title={edits.lockedReason}
          onClick={() => setConfirmingAll(true)}
        >
          모두 기본값으로
        </Button>
      </header>
      <div className={styles.search}>
        <TextField
          aria-label="명령 찾기"
          placeholder="명령, 키"
          icon="search"
          clearable
          block
          value={query}
          onChange={setQuery}
        />
        <SegmentedControl
          label="보기"
          options={[
            {value: 'all', label: '전체'},
            {
              value: 'changed',
              label: '바꾼 것',
              count: counts.changed,
            },
            {
              value: 'conflict',
              label: '겹침',
              count: counts.conflict,
              warning: true,
            },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <div className={styles.columns} aria-hidden="true">
        <span>{LIST_LABEL}</span>
        <span className={styles.keyColumn}>단축키</span>
      </div>
      <div
        ref={list}
        role="listbox"
        aria-label={LIST_LABEL}
        className={styles.list}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) {
            if (
              !(event.target instanceof HTMLElement) ||
              event.target.dataset['command'] === undefined
            ) {
              return;
            }
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            moveSelection(event.key === 'ArrowDown' ? 1 : -1);
          }
        }}
      >
        {groups.map(group => (
          <div key={group.title} role="group" aria-label={group.title}>
            <p className={styles.group}>{group.title}</p>
            {group.rows.map(row => (
              <CommandRow
                key={row.command.id}
                row={row}
                selected={row.command.id === selectedId}
                editing={row.command.id === editingId}
                locked={locked}
                onSelect={() => setSelectedId(row.command.id)}
                onEdit={() => {
                  setSelectedId(row.command.id);
                  setEditingId(row.command.id);
                }}
                onRecord={binding => {
                  setEditingId(null);
                  edits.record(row.command, binding);
                }}
                onCancel={() => setEditingId(null)}
              />
            ))}
          </div>
        ))}
      </div>
      <footer className={styles.bar}>
        {selected === undefined ? null : (
          <>
            <span className={styles.barName}>{selected.command.name}</span>
            <span className={styles.barDefault}>
              {selected.command.defaults.length === 0 ? (
                NO_DEFAULT
              ) : (
                <>
                  기본값
                  <KeyList>
                    {selected.command.defaults.map(binding => (
                      <KeyCombo
                        key={keysOf(binding).join('+')}
                        keys={keysOf(binding)}
                      />
                    ))}
                  </KeyList>
                </>
              )}
            </span>
            <Button
              disabled={locked || !selected.changed}
              title={edits.lockedReason}
              onClick={() => edits.reset(selected.command.id)}
            >
              기본값으로
            </Button>
            <Button
              disabled={locked || selected.bindings.length === 0}
              title={edits.lockedReason}
              onClick={() => edits.record(selected.command, null)}
            >
              지우기
            </Button>
          </>
        )}
      </footer>
      {confirmingAll ? (
        <AlertDialog
          icon="undo"
          title="모든 단축키를 기본값으로 되돌립니다"
          onCancel={() => setConfirmingAll(false)}
          actions={[
            {
              label: '모두 기본값으로',
              primary: true,
              onSelect: () => {
                setConfirmingAll(false);
                edits.resetAll();
              },
            },
          ]}
        />
      ) : null}
    </div>
  );
}
