import {NAME_LIMIT} from '@core/schema/common/primitives';
import {displayReference} from '@core/bible';
import {RenameDialog} from '@renderer/ui/popups/RenameDialog';
import {useMenuHandoff} from '@renderer/ui/menus/useMenuHandoff';
import {
  openMenuFromKey,
  pointerMenuAnchor,
} from '@renderer/ui/menus/contextMenu';
import {useEffect, useState, type JSX, type ReactNode} from 'react';
import {limitReason} from '@core/common/limitReason';
import {createQuickItemId, createTimerId} from '@core/schema/common/ids';
import type {LlpApi} from '@contracts/ipc/api';
import {MAX_QUICK_ITEMS, type QuickItem} from '@core/schema/tools/quick';
import {MAX_TIMER_DEFINITIONS, type Timer} from '@core/schema/tools/timers';
import {isItemOfKind} from '@core/schema/services/service';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import {
  bibleSourceFor,
  isLibrarySource,
} from '@renderer/session/show/showLibrary';
import {withinLookupTimeout} from '@renderer/session/show/showOutput';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {Menu} from '@renderer/ui/menus/Menu';
import {ListInsertLine} from '@renderer/ui/lists/ListRow';
import {openOnArrowDown} from '@renderer/ui/menus/menuButton';
import {
  menuAvailability,
  type MenuEntry,
  type MenuAnchor,
} from '@renderer/ui/menus/menuModel';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';
import {newQuickItem, type QuickChoice, type QuickEdit} from './quickEdits';
import {useTimerEditDialog} from '../tools/timers/useTimerEditDialog';
import {QuickTimerDialog} from './QuickTimerDialog';
import {quickItemMenuEntries, toolMenuReason} from '../tools/toolMenuEntries';
import {useShow} from '@renderer/session/show/showStore';

type Save = (
  edit: QuickEdit,
  completion?: 'applied' | 'saved',
) => Promise<boolean>;

async function currentChoice(api: LlpApi): Promise<QuickChoice | null> {
  const view = useShow.getState();
  const bible = bibleSourceFor(view, view.openItemId);
  if (bible) {
    return {
      kind: 'bible',
      name: bible.passage.displayRef,
      ref: {
        translation: bible.passage.translation,
        ref: bible.passage.ref,
        verseNumbers: bible.verseNumbers,
        translationName: bible.translationName ?? false,
      },
    };
  }
  if (isLibrarySource(view, view.openItemId)) {
    return {
      kind: 'song',
      name: view.librarySong.title,
      ref: view.librarySong.songId,
    };
  }
  const {serviceId, openItemId} = view;
  if (serviceId === null || openItemId === null) return null;
  const document = await withinLookupTimeout(() => api.services.get(serviceId));
  const item = document?.service.order.find(item => item.id === openItemId);
  if (!item) return null;
  if (isItemOfKind(item, 'bible')) {
    return {
      kind: 'bible',
      name: displayReference(item.passage.ref),
      ref: item.passage,
    };
  }
  if (isItemOfKind(item, 'song')) {
    return {
      kind: 'song',
      name: view.rows.find(row => row.id === item.id)?.title ?? '곡',
      ref: item.song,
    };
  }
  return null;
}

function QuickAddMenu({
  api,
  anchor,
  onAdd,
  onAddTimer,
  onClose,
  onProblem,
}: {
  readonly api: LlpApi;
  readonly anchor: MenuAnchor;
  readonly onAdd: (choice: QuickChoice) => void;
  readonly onAddTimer: () => void;
  readonly onClose: () => void;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const props = useSettingsDocument('props', '그래픽', onProblem);
  const macros = useSettingsDocument('macros', '매크로', onProblem);
  const view = useShow();
  const [current, setCurrent] = useState<{
    view: typeof view;
    choice: QuickChoice | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    currentChoice(api).then(
      choice => {
        if (active) setCurrent({view, choice});
      },
      (cause: unknown) => {
        api.log.write({
          level: 'error',
          message: 'Could not read the quick add source',
          detail: String(cause),
        });
        if (active) {
          onProblem(warningNotice('quick:source', '항목 불러오기 실패'));
        }
      },
    );
    return () => {
      active = false;
    };
  }, [api, view, onProblem]);
  const choice = current?.view === view ? current.choice : null;
  const entry = (id: string, target: QuickChoice): MenuEntry => ({
    kind: 'item',
    id,
    label: target.name || '이름 없음',
    onSelect: () => onAdd(target),
  });
  const group = ({
    id,
    label,
    submenu,
    reason,
  }: {
    readonly id: string;
    readonly label: string;
    readonly submenu: readonly MenuEntry[];
    readonly reason: string;
  }): MenuEntry => ({
    kind: 'item',
    id,
    label,
    submenu,
    ...menuAvailability(submenu.length === 0 ? reason : undefined),
  });
  return (
    <Menu
      label="빠른 실행 추가"
      anchor={anchor}
      onClose={onClose}
      entries={[
        {
          kind: 'item',
          id: 'current',
          label: '현재 항목 추가',
          meta: choice?.name,
          ...menuAvailability(
            choice === null
              ? current?.view === view
                ? '추가할 현재 항목 없음'
                : '현재 항목 불러오는 중'
              : undefined,
          ),
          onSelect: () => {
            if (choice) onAdd(choice);
          },
        },
        {kind: 'separator', id: 'targets'},
        group({
          id: 'props',
          label: '그래픽',
          submenu:
            props?.value.props.map(item =>
              entry(item.id, {kind: 'prop', name: item.name, ref: item.id}),
            ) ?? [],
          reason: props === null ? '그래픽 불러오는 중' : '그래픽 없음',
        }),
        {kind: 'item', id: 'timer', label: '타이머…', onSelect: onAddTimer},
        group({
          id: 'macros',
          label: '매크로',
          submenu:
            macros?.value.macros.map(item =>
              entry(item.id, {kind: 'macro', name: item.name, ref: item.id}),
            ) ?? [],
          reason: macros === null ? '매크로 불러오는 중' : '매크로 없음',
        }),
      ]}
    />
  );
}

export function QuickAdd({
  api,
  locked,
  save,
  onProblem,
}: {
  readonly api: LlpApi;
  readonly locked: boolean;
  readonly save: Save;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [addingTimer, setAddingTimer] = useState(false);
  const open = anchor !== null;
  return (
    <>
      <IconButton
        icon="plus"
        label="빠른 실행 추가"
        menu
        expanded={open}
        disabled={locked}
        onClick={event => setAnchor(open ? null : event.currentTarget)}
        onKeyDown={event =>
          openOnArrowDown(event, {
            expanded: open,
            onExpandedChange: next =>
              setAnchor(next ? event.currentTarget : null),
            disabled: locked,
          })
        }
      />
      {anchor && !locked ? (
        <QuickAddMenu
          api={api}
          anchor={{kind: 'element', element: anchor}}
          onClose={() => setAnchor(null)}
          onProblem={onProblem}
          onAddTimer={() => setAddingTimer(true)}
          onAdd={choice => {
            save({kind: 'add', item: newQuickItem(choice)}).catch(
              (cause: unknown) =>
                console.error('Quick add callback failed:', cause),
            );
          }}
        />
      ) : null}
      {addingTimer ? (
        <QuickTimerDialog
          locked={locked}
          save={save}
          onClose={() => setAddingTimer(false)}
        />
      ) : null}
    </>
  );
}

/** Why a 빠른 실행 row can't be copied now, for its menu row and Ctrl D. */
export function quickCopyReason(
  item: QuickItem,
  state: {
    readonly locked: boolean;
    readonly full: boolean;
    readonly timersFull: boolean;
  },
): string | undefined {
  if (state.locked) return toolMenuReason(state.locked);
  if (state.full) return limitReason('빠른 실행 항목', MAX_QUICK_ITEMS);
  return item.kind === 'timer' && state.timersFull
    ? limitReason('타이머', MAX_TIMER_DEFINITIONS)
    : undefined;
}

/** Copies a 빠른 실행 row; a row of a 타이머 gets its own new 타이머. */
export function duplicateQuickItem(item: QuickItem, save: Save): void {
  save({
    kind: 'duplicate',
    id: item.id,
    copyId: createQuickItemId(crypto.randomUUID()),
    ...(item.kind === 'timer'
      ? {timerCopyId: createTimerId(crypto.randomUUID())}
      : {}),
  }).catch((cause: unknown) =>
    console.error('Quick copy callback failed:', cause),
  );
}

export function QuickRowEditor({
  api,
  item,
  timer,
  onProblem,
  locked,
  full,
  timersFull,
  save,
  children,
  insertBefore = false,
  onPinChange,
  activate,
  activateReason,
  onDelete,
}: {
  readonly api: LlpApi;
  readonly item: QuickItem;
  /** The 타이머 a timer row refers to, once it is known. */
  readonly timer?: Timer | undefined;
  readonly onProblem: (notice: Notice) => void;
  readonly locked: boolean;
  /** Whether the list holds as many 빠른 실행 항목 as it may. */
  readonly full: boolean;
  /** Whether the 타이머 list is full, which stops a copy of a 타이머 row. */
  readonly timersFull: boolean;
  readonly save: Save;
  readonly children: ReactNode;
  readonly activate?: (() => void) | undefined;
  readonly activateReason?: string | undefined;
  readonly onDelete: () => void;
  readonly insertBefore?: boolean;
  readonly onPinChange?: ((id: string, active: boolean) => void) | undefined;
}): JSX.Element {
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const [renaming, setRenaming] = useState(false);
  const change = useTimerEditDialog({
    api,
    timer,
    menuOpen: menu !== null,
    locked,
    onProblem,
  });
  const renameAfterMenu = useMenuHandoff(menu !== null, () =>
    setRenaming(true),
  );
  const deleteAfterMenu = useMenuHandoff(menu !== null, onDelete);
  const duplicateReason = quickCopyReason(item, {locked, full, timersFull});
  const duplicate = (): void => duplicateQuickItem(item, save);
  useEffect(() => {
    if (!menu && !renaming) return undefined;
    onPinChange?.(item.id, true);
    return () => onPinChange?.(item.id, false);
  }, [item.id, menu, renaming, onPinChange]);
  return (
    <div
      data-quick-id={item.id}
      onContextMenu={event => {
        event.preventDefault();
        setMenu(pointerMenuAnchor(event));
      }}
      onKeyDown={event => {
        openMenuFromKey(event, setMenu);
      }}
    >
      {insertBefore ? <ListInsertLine /> : null}
      {children}
      {menu ? (
        <Menu
          context
          label="빠른 실행 항목"
          anchor={menu}
          onClose={() => setMenu(null)}
          entries={[
            ...(activate === undefined
              ? []
              : [
                  {
                    kind: 'item' as const,
                    id: 'run',
                    contextGroup: 'default' as const,
                    label: '실행',
                    ...menuAvailability(activateReason),
                    onSelect: activate,
                  },
                ]),
            ...quickItemMenuEntries({
              reason: toolMenuReason(locked),
              ...(item.kind === 'timer'
                ? {
                    edit: {onSelect: change.open, reason: change.reason},
                  }
                : {}),
              rename: () => {
                renameAfterMenu(true);
              },
              duplicate,
              duplicateReason,
              remove: () => {
                deleteAfterMenu(true);
                setMenu(null);
              },
            }),
          ]}
        />
      ) : null}
      {change.dialog}
      {renaming ? (
        <RenameDialog
          title="빠른 실행 이름 바꾸기"
          name={item.name}
          locked={locked}
          rename={{
            maxLength: NAME_LIMIT,
            onClose: () => setRenaming(false),
            onCommit: name =>
              save({kind: 'rename', id: item.id, name}, 'saved'),
          }}
        />
      ) : null}
    </div>
  );
}
