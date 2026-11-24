import {liveItemReason} from '@renderer/session/liveGuard';
import type {RefObject} from 'react';
import type {ServiceRow} from '@core/presentation';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {undoReason, undoTimeline} from '@renderer/platform/undoTimeline';
import type {Notice} from '@renderer/ui/popups/notices';
import {orderEditReason} from '@renderer/session/orderReasons';
import {ORDER_FULL_REASON} from '@renderer/session/serviceOrderEdits';
import {isInTextEntry} from '@renderer/ui/fields/textEntry';
import type {Workspace} from '@renderer/ui/lists/workspace';
import type {ChosenRows, useOrderEdits} from './useOrderEdits';
import type {useServiceItemClipboard} from './useServiceItemClipboard';
import {serviceOrderRowId} from './useServiceOrderDrag';
import {FIXED_KEYS} from '@renderer/ui/keys/fixedKeys';

type Clipboard = Pick<
  ReturnType<typeof useServiceItemClipboard>,
  'copy' | 'paste' | 'copyReason' | 'pasteReason'
>;

/**
 * The keys of the 예배 순서 list: move, copy, paste, undo, redo, duplicate
 * and delete, while the focus is on a row of the list.
 */
export function useOrderShortcuts({
  list,
  rows,
  cursor,
  workspace,
  palette,
  editable,
  full,
  selection,
  clipboard,
  edits,
  report,
}: {
  readonly list: RefObject<HTMLElement | null>;
  readonly rows: readonly ServiceRow[];
  /** The open item. */
  readonly cursor: string | null;
  readonly workspace: Workspace;
  /** Whether 예배 요소 sits beside the list and shares its history keys. */
  readonly palette: boolean;
  readonly editable: boolean;
  readonly full: boolean;
  readonly selection: ChosenRows;
  readonly clipboard: Clipboard;
  readonly edits: ReturnType<typeof useOrderEdits>;
  /** Tells why a step of the window could not run back. */
  readonly report: (notice: Notice) => void;
}): void {
  const {targets, moveItems, runFocusedEdit, remove, duplicate} = edits;
  // NOTE(0913vision): The latest step of the window may be another one than
  // a change of this list; its own history tells why it could not run.
  const replayLatest = (kind: 'undo' | 'redo'): void =>
    runFocusedEdit(async () => ({
      ok: true,
      value: await undoTimeline.replay(kind, report),
    }));

  const ownsCommand = (event: KeyboardEvent): boolean =>
    event.target instanceof Node &&
    !isInTextEntry(event.target) &&
    list.current?.contains(event.target) === true;
  const inRows = (event: KeyboardEvent): boolean =>
    ownsCommand(event) &&
    event.target instanceof Node &&
    list.current?.querySelector('[role="listbox"]')?.contains(event.target) ===
      true;
  const ownsPaletteHistory = (event: KeyboardEvent): boolean =>
    palette &&
    event.target instanceof Element &&
    !isInTextEntry(event.target) &&
    event.target.closest('[data-panel="prep-palette"]') !== null;
  const ownsHistory = (event: KeyboardEvent): boolean =>
    ownsCommand(event) || ownsPaletteHistory(event);

  /** The open item when it is chosen, otherwise the last chosen row. */
  const pasteAfter = (): string | null =>
    cursor !== null && selection.selected.has(cursor)
      ? cursor
      : (rows.filter(row => selection.selected.has(row.id)).at(-1)?.id ?? null);
  const moveFromKey = (
    event: KeyboardEvent,
    direction: 'up' | 'down',
  ): void => {
    const id = event.target === null ? null : serviceOrderRowId(event.target);
    if (id === null) return;
    moveItems(
      selection.selected.has(id) ? [...selection.selected] : [id],
      direction,
      id,
    );
  };

  useWindowShortcuts([
    {
      id: 'list.moveUp',
      context: 'service',
      when: event => workspace === 'prep' && ownsCommand(event),
      run: event => moveFromKey(event, 'up'),
    },
    {
      id: 'list.moveDown',
      context: 'service',
      when: event => workspace === 'prep' && ownsCommand(event),
      run: event => moveFromKey(event, 'down'),
    },
    {
      id: 'edit.copy',
      fixedBindings: [FIXED_KEYS.copy],
      context: 'service',
      when: ownsCommand,
      unavailable: () => clipboard.copyReason,
      run: () => clipboard.copyReason === undefined && clipboard.copy(),
    },
    {
      id: 'edit.paste',
      fixedBindings: [FIXED_KEYS.paste],
      context: 'service',
      when: ownsCommand,
      unavailable: () => clipboard.pasteReason,
      run: () => clipboard.paste(pasteAfter()),
    },
    {
      id: 'edit.undo',
      context: 'service',
      when: ownsHistory,
      unavailable: () => undoReason('undo'),
      run: () => replayLatest('undo'),
    },
    {
      id: 'edit.redo',
      context: 'service',
      when: ownsHistory,
      unavailable: () => undoReason('redo'),
      run: () => replayLatest('redo'),
    },
    {
      id: 'edit.duplicate',
      context: 'service',
      when: event => cursor !== null && inRows(event),
      unavailable: () =>
        orderEditReason(editable, full ? ORDER_FULL_REASON : undefined),
      run: () => {
        if (!full) duplicate(targets());
      },
    },
    {
      id: 'edit.delete',
      context: 'service',
      when: inRows,
      unavailable: () => liveItemReason(targets()),
      run: () => remove(targets()),
    },
  ]);
}
