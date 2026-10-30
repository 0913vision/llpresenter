import {useEffect, useState, type JSX, type ReactNode} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {QuickItem} from '@shared/schema/quick';
import {isItemOfKind} from '@shared/schema/service';
import {useSettingsDocument} from '@renderer/screens/useSettingsDocument';
import {useShow} from '@renderer/state/show';
import {bibleSourceFor, isLibrarySource} from '@renderer/state/showLibrary';
import {withinLookupTimeout} from '@renderer/state/showOutput';
import {
  Dialog,
  IconButton,
  Menu,
  TextField,
  ListInsertLine,
} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {
  newQuickItem,
  QUICK_NAME_LIMIT,
  quickNameReason,
  type QuickChoice,
  type QuickEdit,
} from './quickEdits';
import {QuickTimerDialog} from './QuickTimerDialog';
import {quickItemMenuEntries, toolMenuReason} from '../tools/toolMenuEntries';

type Save = (edit: QuickEdit) => Promise<boolean>;

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
        split: 'verse',
        reference: 'none',
        verseNumbers: bible.verseNumbers,
        translationName: false,
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
    return {kind: 'bible', name: item.bible.ref, ref: item.bible};
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
  const props = useSettingsDocument('props', '소품', onProblem);
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
          onProblem({
            key: 'quick:source',
            kind: 'warning',
            icon: 'warning',
            title: '항목 불러오기 실패',
            time: noticeTime(),
          });
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
  const group = (
    id: string,
    label: string,
    submenu: readonly MenuEntry[],
  ): MenuEntry => ({
    kind: 'item',
    id,
    label,
    submenu,
    disabled: submenu.length === 0,
  });
  return (
    <Menu
      label="퀵 실행 추가"
      anchor={anchor}
      onClose={onClose}
      entries={[
        {
          kind: 'item',
          id: 'current',
          label: '현재 항목 추가',
          meta: choice?.name,
          disabled: choice === null,
          onSelect: () => {
            if (choice) onAdd(choice);
          },
        },
        {kind: 'separator', id: 'targets'},
        group(
          'props',
          '소품',
          props?.value.props.map(item =>
            entry(item.id, {kind: 'prop', name: item.name, ref: item.id}),
          ) ?? [],
        ),
        {kind: 'item', id: 'timer', label: '타이머…', onSelect: onAddTimer},
        group(
          'macros',
          '매크로',
          macros?.value.macros.map(item =>
            entry(item.id, {kind: 'macro', name: item.name, ref: item.id}),
          ) ?? [],
        ),
        entry('black', {kind: 'black', name: '검은 화면'}),
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
        label="퀵 실행 추가"
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

export function QuickRowEditor({
  item,
  locked,
  save,
  children,
  insertBefore = false,
  onPinChange,
}: {
  readonly item: QuickItem;
  readonly locked: boolean;
  readonly save: Save;
  readonly children: ReactNode;
  readonly insertBefore?: boolean;
  readonly onPinChange?: ((id: string, active: boolean) => void) | undefined;
}): JSX.Element {
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(item.name);
  useEffect(() => {
    if (!menu && !renaming) return undefined;
    onPinChange?.(item.id, true);
    return () => onPinChange?.(item.id, false);
  }, [item.id, menu, renaming, onPinChange]);
  const reason = quickNameReason(name);
  return (
    <div
      data-quick-id={item.id}
      onContextMenu={event => {
        event.preventDefault();
        setMenu({kind: 'point', point: {x: event.clientX, y: event.clientY}});
      }}
      onKeyDown={event => {
        if (!(
          event.key === 'ContextMenu' ||
          (event.shiftKey && event.key === 'F10')
        )) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setMenu({kind: 'element', element: event.currentTarget});
      }}
    >
      {insertBefore ? <ListInsertLine /> : null}
      {children}
      {menu ? (
        <Menu
          label="퀵 실행 항목"
          anchor={menu}
          onClose={() => setMenu(null)}
          entries={quickItemMenuEntries({
            reason: toolMenuReason(locked),
            rename: () => {
              setName(item.name);
              setRenaming(true);
            },
            remove: () => {
              save({kind: 'delete', id: item.id}).catch((cause: unknown) =>
                console.error('Quick delete callback failed:', cause),
              );
            },
          })}
        />
      ) : null}
      {renaming ? (
        <Dialog
          title="퀵 실행 이름 바꾸기"
          size="s"
          onCancel={() => setRenaming(false)}
          primary={{
            label: '저장',
            disabled: locked || reason !== undefined,
            title: reason,
            onSelect: () => {
              save({kind: 'rename', id: item.id, name})
                .then(saved => {
                  if (saved) setRenaming(false);
                })
                .catch((cause: unknown) =>
                  console.error('Quick rename callback failed:', cause),
                );
            },
          }}
        >
          <TextField
            aria-label="이름"
            block
            autoFocus
            value={name}
            onChange={setName}
            maxLength={QUICK_NAME_LIMIT}
            readOnly={locked}
            invalid={reason !== undefined}
            invalidReason={reason}
            onFocus={event => event.currentTarget.select()}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
