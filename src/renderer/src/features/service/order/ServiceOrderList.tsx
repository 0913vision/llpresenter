import {useRef, useMemo, type JSX} from 'react';
import {createServiceItemId, type SongId} from '@core/schema/common/ids';
import {useServiceActions} from '@renderer/features/service/list/useServiceActions';
import {useOrderFull} from '@renderer/session/service/orderReasons';
import {openInPrep} from '@renderer/session/prepTarget';
import {renameItem} from '@renderer/session/service/serviceOrderEdits';
import {openItem} from '@renderer/session/show/show';
import {useServiceOrderEditing} from '@renderer/session/service/useServiceOrderEditing';
import {ListInsertLine} from '@renderer/ui/lists/ListRow';
import {Menu} from '@renderer/ui/menus/Menu';
import {clickFocusProps} from '@renderer/ui/lists/clickFocus';
import {EmptyState} from '@renderer/ui/lists/EmptyState';
import type {Notice} from '@renderer/ui/popups/notices';
import type {ListWorkspace} from '@renderer/ui/lists/workspace';
import {useMediaDurations} from './rows/useMediaDurations';
import {ItemRows, type RowContext} from './rows/ItemRows';
import {NoServiceState} from './NoServiceState';
import {orderMenuEntries} from './menu/orderMenuEntries';
import {groupRows} from './orderRows';
import {OrderSection} from './rows/OrderSection';
import type {ServiceTableParts} from './serviceTableParts';
import {useOrderDrop} from './edits/useOrderDrop';
import {useOrderEdits} from './edits/useOrderEdits';
import {useOrderListEvents} from './useOrderListEvents';
import {useOrderMenu} from './menu/useOrderMenu';
import {useOrderRename} from './edits/useOrderRename';
import {useOrderRowStates} from './rows/useOrderRowStates';
import {useOrderScroll} from './scroll/useOrderScroll';
import {useOrderShortcuts} from './edits/useOrderShortcuts';
import {useServiceItemClipboard} from './edits/useServiceItemClipboard';
import {useServiceItemSelection} from './useServiceItemSelection';
import styles from './ServiceOrderList.module.css';
import {useShow} from '@renderer/session/show/showStore';
import {scrollGridToItem} from '@renderer/session/show/visibleSlideItem';
import {ListBox} from '@renderer/ui/lists/ListBox';

function closeNothing(): void {
  return undefined;
}

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
  readonly workspace?: ListWorkspace | undefined;
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
  const {rows, numbers, openItemId, liveItemId, pointedItemId, done} =
    useOrderRowStates(workspace, onProblem);
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const listRef = useRef<HTMLDivElement>(null);
  useOrderScroll(listRef, {
    rows,
    serviceId,
    workspace,
    liveItemId,
    openItemId,
  });

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
  const besidePalette = table !== undefined && !navigator;

  /** Opens a chosen item: beside the editor in 준비, on the grid otherwise. */
  const chooseItem = (itemId: string): void => {
    if (navigator) {
      const kind = rows.find(row => row.id === itemId)?.kind;
      if (kind !== undefined && kind !== 'header') onNavigate?.(itemId);
      return;
    }
    onOpenItem?.();
    openItem(itemId);
    scrollGridToItem(itemId);
  };
  const selectableIds = useMemo(
    () =>
      rows
        .filter(row => workspace === 'prep' || row.kind !== 'header')
        .map(row => row.id),
    [rows, workspace],
  );
  const selection = useServiceItemSelection({
    serviceId,
    cursor: pointedItemId,
    ids: selectableIds,
    onSelect: chooseItem,
  });
  const drop = useOrderDrop({
    rows,
    workspace,
    editable,
    takesNewItems: besidePalette,
    selection,
    editing,
    onProblem,
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
  const menu = useOrderMenu({rows, serviceId, selection, onProblem});
  const rename = useOrderRename({
    rows,
    serviceId,
    editable,
    menuOpen: menu.menu !== null,
    save: editing.save,
  });
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
    palette: besidePalette,
    editable,
    full,
    selection,
    clipboard,
    edits,
    report: onProblem,
  });

  /** Opens an item of 준비 in its editor; false where nothing opens. */
  const openOrderEditor = (id: string | null): boolean => {
    if (workspace !== 'prep' || id === null || serviceId === null) return false;
    const kind = rows.find(row => row.id === id)?.kind;
    if (kind === undefined || kind === 'header' || kind === 'unknown') {
      return false;
    }
    openInPrep({kind: 'item', itemId: id});
    return true;
  };
  const listEvents = useOrderListEvents({
    navigator,
    workspace,
    selection,
    clickCapture: drop.dragProps.onClickCapture,
    openMenu: menu.open,
    openOrderEditor,
  });

  const rowContext: RowContext = {
    navigator,
    selected: selection.selected,
    liveItemId,
    done,
    editable,
    insertBefore: drop.insertBefore,
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
      {...drop.dragProps}
      {...listEvents}
    >
      {table?.header}
      <ListBox
        multiple
        workspace={workspace}
        label="예배 순서"
        selected={pointedItemId ?? undefined}
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
              insertLine={drop.insertBefore === group.id}
              done={done.has(group.id)}
              selected={selection.selected.has(group.id)}
              renaming={rename.renaming === group.id}
              onRename={() => rename.start(group.id)}
              onCommitName={name =>
                editing.save(() =>
                  renameItem(createServiceItemId(group.id), name),
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
      {drop.insertBefore === null ? <ListInsertLine /> : null}
      {table?.footer}
      {drop.dialog}
      {serviceActions.dialogs}
      {menu.menu === null ? null : (
        <Menu
          context
          label="예배 순서 항목 메뉴"
          anchor={menu.menu.anchor}
          onClose={() => menu.setMenu(null)}
          entries={orderMenuEntries(menu.menu, {
            rows,
            workspace,
            editable,
            full,
            serviceId,
            edits,
            selection,
            clipboard,
            songMenu: menu.songMenu,
            table,
            openOrderEditor,
            renameAfterMenu: rename.afterMenu,
            onOpenPrep,
            onShowInLibrary,
            setMenu: menu.setMenu,
          })}
        />
      )}
      {menu.songMenu.dialog}
    </div>
  );
}
