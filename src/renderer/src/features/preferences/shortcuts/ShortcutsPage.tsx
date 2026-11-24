import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {AlertDialog} from '@renderer/ui/popups/AlertDialog';
import {Button} from '@renderer/ui/buttons/Button';
import {EmptyState} from '@renderer/ui/lists/EmptyState';
import {contextMenuAnchor, takeMenuKey} from '@renderer/ui/menus/contextMenu';
import {Menu, type MenuAnchor} from '@renderer/ui/menus/Menu';
import {SegmentedControl} from '@renderer/ui/choices/SegmentedControl';
import {TextField} from '@renderer/ui/fields/TextField';
import type {Notice} from '@renderer/ui/popups/notices';
import {
  buildRows,
  emptyRowsText,
  filterRows,
  groupRows,
  shortcutCounts,
  type ShortcutFilter,
} from './shortcutsModel';
import {useShortcutEdits} from './useShortcutEdits';
import {CommandRow} from './CommandRow';
import {SelectedShortcutBar} from './SelectedShortcutBar';
import {shortcutRowMenuEntries} from './shortcutRowMenu';
import styles from './ShortcutsPage.module.css';

const LIST_LABEL = '명령';

function commandRowOf(
  target: EventTarget,
): {readonly id: string; readonly element: HTMLElement} | null {
  const element =
    target instanceof Element
      ? target.closest<HTMLElement>('[data-command]')
      : null;
  const id = element?.dataset['command'];
  return element === null || id === undefined ? null : {id, element};
}

/** Opens below the row itself, also when a key opened the menu. */
function rowAnchor(row: HTMLElement): MenuAnchor {
  return {kind: 'element', element: row, target: row};
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
  const [menu, setMenu] = useState<{id: string; anchor: MenuAnchor} | null>(
    null,
  );
  const list = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () => buildRows(edits.commands, edits.overrides),
    [edits.commands, edits.overrides],
  );
  const counts = shortcutCounts(rows);
  const shown = filterRows(rows, query, filter);
  const groups = groupRows(shown);
  const emptyText = emptyRowsText(query, filter);
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
  const menuRow = rows.find(row => row.command.id === menu?.id);
  const openMenu = (id: string, anchor: MenuAnchor): void => {
    setSelectedId(id);
    setMenu({id, anchor});
  };
  const moveSelection = (step: 1 | -1): void => {
    const at = shown.findIndex(row => row.command.id === selectedId);
    const next = shown[Math.max(0, Math.min(shown.length - 1, at + step))];
    if (next === undefined) return;
    setSelectedId(next.command.id);
    list.current
      ?.querySelector<HTMLElement>(`[data-command="${next.command.id}"]`)
      ?.focus();
  };
  /** The arrows on the list or a row move the selection a row. */
  const walkRows = (event: KeyboardEvent<HTMLDivElement>): void => {
    const onRow =
      event.target instanceof HTMLElement &&
      event.target.dataset['command'] !== undefined;
    if (event.target !== event.currentTarget && !onRow) return;
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    moveSelection(event.key === 'ArrowDown' ? 1 : -1);
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
              label: '바꿈',
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
        onContextMenu={event => {
          const row = commandRowOf(event.target);
          if (row === null) return;
          event.preventDefault();
          openMenu(row.id, contextMenuAnchor(event));
        }}
        onKeyDownCapture={event => {
          const row = commandRowOf(event.target);
          if (row === null || !takeMenuKey(event)) return;
          openMenu(row.id, rowAnchor(row.element));
        }}
        onKeyDown={walkRows}
      >
        {groups.length === 0 && emptyText !== undefined ? (
          <EmptyState text={emptyText} />
        ) : null}
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
      {menu === null || menuRow === undefined ? null : (
        <Menu
          context
          label="단축키 행 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={shortcutRowMenuEntries(menuRow, edits.lockedReason, {
            edit: setEditingId,
            reset: edits.reset,
            clear: command => edits.record(command, null),
          })}
        />
      )}
      <SelectedShortcutBar
        row={selected}
        lockedReason={edits.lockedReason}
        onReset={id => edits.reset(id)}
        onClear={command => edits.record(command, null)}
      />
      {confirmingAll ? (
        <AlertDialog
          icon="undo"
          title="모든 단축키를 기본값으로 되돌릴까요?"
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
