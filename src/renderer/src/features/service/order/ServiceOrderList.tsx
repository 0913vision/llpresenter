import {useShownItemId} from '@renderer/session/shownItem';
import {dropMediaInOrder} from './dropMediaInOrder';
import {insertLibrarySong} from '@renderer/session/insertNewItem';
import {usePaletteInsert} from '../items/usePaletteInsert';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useReflow} from '@renderer/ui/useReflow';
import {useOrderFull} from '@renderer/session/orderReasons';
import {
  moveItems as moveOrderItems,
  renameItem as renameOrderItem,
} from '@renderer/session/serviceOrderEdits';
import {openInPrep} from '@renderer/session/prepTarget';
import {EmptyState} from '@renderer/ui/EmptyState';
import {NoServiceState} from './NoServiceState';
import {useServiceActions} from '@renderer/features/service/list/useServiceActions';
import {useEffect, useMemo, useRef, useState, type JSX} from 'react';
import {createServiceItemId, type SongId} from '@core/schema/ids';
import {useOrderEdits} from './useOrderEdits';
import {useOrderRename} from './useOrderRename';
import {useOrderListEvents} from './useOrderListEvents';
import {orderMenuEntries} from './orderMenuEntries';
import {useOrderShortcuts} from './useOrderShortcuts';
import {useOrderResizeFocus} from './useOrderResizeFocus';
import {useOrderFollow} from './useOrderFollow';
import {useOrderTop} from './useOrderTop';
import {usePrepOrderPosition} from './usePrepOrderPosition';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {clickFocusProps} from '@renderer/ui/clickFocus';
import {openItem, useShow} from '@renderer/session/show';
import {useVisibleSlideItem} from '@renderer/session/visibleSlideItem';
import {ListBox, ListInsertLine, Menu} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import type {Workspace} from '@renderer/ui/workspace';
import {useServiceOrderEditing} from '@renderer/session/useServiceOrderEditing';
import {useServiceItemSelection} from './useServiceItemSelection';
import {useServiceItemClipboard} from './useServiceItemClipboard';
import type {ServiceTableParts} from './serviceTableParts';
import {useServiceSongMenu} from './useServiceSongMenu';
import {useServiceOrderDrag} from './useServiceOrderDrag';
import {useMediaDurations} from '../../media/useMediaDurations';
import {ItemRows, type RowContext} from './ItemRows';
import {OrderSection} from './OrderSection';
import {groupRows, itemNumbers, rowsOfMenu} from './orderRows';
import {useLiveItemId} from './useLiveItemId';
import styles from './ServiceOrderList.module.css';

const closeNothing = (): void => undefined;

function logProblem(notice: Notice): void {
  console.error('Service order edit failed:', notice.key);
}

/** The main-owned 예배 순서 list shared by 진행 and 준비. */
export function ServiceOrderList({
  workspace = 'show',
  navigator = false,
  onNavigate,
  onProblem = logProblem,
  onOpenPrep,
  onOpenItem,
  onShowInLibrary,
  table,
}: {
  readonly workspace?: Workspace | undefined;
  readonly navigator?: boolean | undefined;
  /** Opens another item in the editor that this list is beside. */
  readonly onNavigate?: ((id: string) => void) | undefined;
  readonly table?: ServiceTableParts | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep?:
    ((itemId: string, position?: number) => void) | undefined;
  readonly onOpenItem?: (() => void) | undefined;
  readonly onShowInLibrary?: ((songId: SongId) => void) | undefined;
}): JSX.Element {
  const rows = useShow(view => view.rows);
  const numbers = useMemo(() => itemNumbers(rows), [rows]);
  const openItemId = useShownItemId();
  const liveItemId = useLiveItemId();
  const preferences = useSettingsDocument('preferences', '환경설정', onProblem);
  const dimPastItems = preferences?.value.show?.dimPastItems === true;
  const visibleSlideItem = useVisibleSlideItem();
  const gridItemId =
    workspace === 'show' && preferences?.value.show?.continuousGrid === true
      ? visibleSlideItem
      : openItemId;
  const done = useMemo(() => {
    const current = dimPastItems
      ? rows.findIndex(row => row.id === liveItemId)
      : -1;
    return new Set(rows.slice(0, Math.max(0, current)).map(row => row.id));
  }, [rows, liveItemId, dimPastItems]);
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  // NOTE(0913vision): The list owns the 새 예배 dialog, not the empty state,
  // because opening the new service replaces the empty state before the
  // dialog has reported a failed copy.
  const serviceActions = useServiceActions({onProblem, onOpen: closeNothing});
  const editing = useServiceOrderEditing(onProblem);
  const durations = useMediaDurations(
    serviceId,
    workspace === 'prep' && rows.some(row => row.kind === 'media'),
    onProblem,
  );
  // NOTE(0913vision): 진행 doesn't change the 예배 순서; its rows only choose
  // what goes out.
  const editable =
    workspace === 'prep' &&
    !readOnly &&
    !editing.busy &&
    window.llp !== undefined;
  const full = useOrderFull();
  const [menu, setMenu] = useState<{
    id: string;
    serviceId: string | null;
    anchor: MenuAnchor;
  } | null>(null);
  const menuRow = rows.find(row => row.id === menu?.id);
  const songMenu = useServiceSongMenu(
    menu?.serviceId === serviceId && menuRow?.kind === 'song' ? menu : null,
    onProblem,
  );
  const listRef = useRef<HTMLDivElement>(null);
  useReflow(listRef, {
    ids: rows.map(row => row.id),
    selector: '[role="option"][data-value]',
    attribute: 'data-value',
    scope: serviceId,
  });
  const followId = rows.some(row => row.id === liveItemId)
    ? liveItemId
    : openItemId;
  useOrderTop(listRef, serviceId);
  useOrderFollow(listRef, {
    target: followId,
    liveItemId,
    enabled: workspace === 'show',
  });
  usePrepOrderPosition(listRef, {
    target: openItemId,
    enabled: workspace === 'prep',
    rows,
  });
  useOrderResizeFocus(listRef);
  const selectableIds = useMemo(
    () =>
      rows
        .filter(row => workspace === 'prep' || row.kind !== 'header')
        .map(row => row.id),
    [rows, workspace],
  );
  const selection = useServiceItemSelection({
    serviceId,
    cursor: gridItemId,
    ids: selectableIds,
    onSelect: itemId => {
      if (navigator) {
        const kind = rows.find(row => row.id === itemId)?.kind;
        if (kind !== undefined && kind !== 'header') onNavigate?.(itemId);
      } else {
        onOpenItem?.();
        openItem(itemId);
        window.dispatchEvent(
          new CustomEvent('show-grid-item', {detail: itemId}),
        );
      }
    },
  });
  const palette = usePaletteInsert(onProblem);
  const {insertBefore, dragProps} = useServiceOrderDrag({
    enabled: editable,
    allowReorder: workspace === 'prep',
    rows,
    selected: selection.selected,
    select: id => selection.replace([id], id),
    onMove: (ids, before) =>
      editing.run(() =>
        moveOrderItems(
          ids.map(createServiceItemId),
          before === null ? null : createServiceItemId(before),
        ),
      ),
    onElement:
      table === undefined || navigator
        ? undefined
        : (key, before) => palette.insert(key, {before}),
    onMedia:
      table === undefined || navigator
        ? undefined
        : (media, before) => dropMediaInOrder(media, before, onProblem),
    onCopy: (songId, before) =>
      insertLibrarySong(
        songId,
        before === null ? null : createServiceItemId(before),
        onProblem,
      ),
  });
  const clipboard = useServiceItemClipboard({
    serviceId,
    selected: selection.selected,
    editable,
    itemCount: rows.length,
    editing,
    onProblem,
    onPasted: ids => {
      const last = ids.at(-1);
      if (last !== undefined) selection.replace(ids, last);
    },
  });
  const rename = useOrderRename({
    rows,
    serviceId,
    editable,
    menuOpen: menu !== null,
    save: editing.save,
  });

  useEffect(() => {
    const list = listRef.current;
    if (!list?.contains(document.activeElement)) return;
    // NOTE(0913vision): A cell that edits as text keeps its focus when the
    // click that opened it selects the row.
    if (isInTextEntry(document.activeElement)) return;
    list
      .querySelector<HTMLElement>('[tabindex="0"]')
      ?.focus({preventScroll: true});
  }, [openItemId]);

  const edits = useOrderEdits({
    list: listRef,
    rows,
    serviceId,
    cursor: openItemId,
    workspace,
    editable,
    editing,
    selection,
  });
  useOrderShortcuts({
    list: listRef,
    rows,
    cursor: openItemId,
    workspace,
    palette: table !== undefined && !navigator,
    editable,
    full,
    selection,
    clipboard,
    edits,
    report: onProblem,
  });

  const openOrderEditor = (id: string | null): boolean => {
    if (workspace !== 'prep' || id === null || serviceId === null) return false;
    const kind = rows.find(row => row.id === id)?.kind;
    if (kind === undefined || kind === 'header' || kind === 'unknown') {
      return false;
    }
    openInPrep({kind: 'item', itemId: id});
    return true;
  };

  /** Opens the item menu on a row, choosing the row when it is not chosen. */
  const openMenu = (
    id: string,
    list: Element,
    anchor: (targets: readonly HTMLElement[]) => MenuAnchor,
  ): void => {
    if (!selection.selected.has(id)) selection.replace([id], id);
    setMenu({
      id,
      serviceId,
      anchor: anchor(rowsOfMenu(list, id, selection.selected)),
    });
  };
  const listEvents = useOrderListEvents({
    navigator,
    workspace,
    selection,
    clickCapture: dragProps.onClickCapture,
    openMenu,
    openOrderEditor,
  });
  const rowContext: RowContext = {
    navigator,
    selected: selection.selected,
    liveItemId,
    done,
    editable,
    insertBefore,
    workspace,
    durations,
    table,
    numbers,
    renaming: rename.renaming,
    rename: rename.itemRename,
  };
  return (
    <div
      {...clickFocusProps}
      ref={listRef}
      tabIndex={-1}
      className={styles.list}
      aria-busy={editing.busy}
      {...dragProps}
      {...listEvents}
    >
      {table?.header}
      <ListBox
        multiple
        workspace={workspace}
        label="예배 순서"
        selected={gridItemId ?? undefined}
        onSelect={selection.select}
      >
        {groupRows(rows).map(group =>
          group.label === undefined ? (
            <ItemRows key={group.id} items={group.items} context={rowContext} />
          ) : (
            <OrderSection
              key={group.id}
              group={group}
              label={group.label}
              context={rowContext}
              workspace={workspace}
              editable={editable}
              className={table?.sectionClass}
              insertLine={insertBefore === group.id}
              done={done.has(group.id)}
              selected={selection.selected.has(group.id)}
              renaming={rename.renaming === group.id}
              onRename={() => rename.start(group.id)}
              onCommitName={name =>
                editing.save(() =>
                  renameOrderItem(createServiceItemId(group.id), name),
                )
              }
              onCloseRename={rename.stop}
            />
          ),
        )}
        {rows.length === 0 && serviceId !== null ? (
          <EmptyState text="항목 없음" />
        ) : null}
      </ListBox>
      {rows.length === 0 && serviceId === null ? (
        <NoServiceState
          onNewService={() => serviceActions.entries.newService.onSelect?.()}
        />
      ) : null}
      {insertBefore === null ? <ListInsertLine /> : null}
      {table?.footer}
      {palette.dialog}
      {serviceActions.dialogs}
      {menu?.serviceId === serviceId ? (
        <Menu
          context
          label="예배 순서 항목 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={orderMenuEntries(menu, {
            rows,
            workspace,
            editable,
            full,
            serviceId,
            edits,
            selection,
            clipboard,
            songMenu,
            table,
            openOrderEditor,
            renameAfterMenu: rename.afterMenu,
            onOpenPrep,
            onShowInLibrary,
            setMenu,
          })}
        />
      ) : null}
      {songMenu.dialog}
    </div>
  );
}
