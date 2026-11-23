import {focusHistorySurface} from '@renderer/ui/focusHistorySurface';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {menuAvailability} from '@renderer/ui/menuModel';
import {
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {ServiceEntry} from '@core/schema/contentDocuments';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {useShow} from '@renderer/session/show';
import {contentDeleteHistory} from '@renderer/platform/contentDeleteHistory';
import {deleteSelection} from '@renderer/ui/deleteSelection';
import {historyKey} from '@renderer/ui/historyKey';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {RenameDialog} from '@renderer/ui/RenameDialog';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {
  editApplied,
  renameService,
  settle,
  warningNotice,
} from './serviceEdits';
import type {ServiceSource} from './useServiceSources';
import {
  contextMenuAnchor,
  type ContextMenuEvent,
} from '../../../ui/contextMenu';
import {useAlive} from '@renderer/ui/useAlive';

type NamedSource = Exclude<ServiceSource, {readonly kind: 'empty'}>;

/** A 템플릿 or 예배 순서 row the operator right-clicked, with its list name. */
export interface SourceRow {
  readonly source: NamedSource;
  readonly name: string;
  readonly access: ServiceEntry['access'];
}

type SourceActionsApi = Pick<
  LlpApi,
  'content' | 'services' | 'templates' | 'log'
>;

const OPEN_SERVICE = '열린 예배는 삭제할 수 없습니다.';
const problemTitles = {
  rename: '이름 바꾸기 실패',
  delete: '삭제 실패',
} as const;

function kindName(source: NamedSource): string {
  return source.kind === 'template' ? '템플릿' : '예배';
}

const emptyHistory = {undo: 0, redo: 0, busy: false};
const noHistory = () => emptyHistory;
const noSubscribe = () => () => undefined;

// NOTE(0913vision): A rename sends the whole document with the revision it
// was read at, as every `*.update` does; main refuses it as stale when the
// document changed in between.
async function renameSource(
  api: SourceActionsApi,
  {source, name}: Pick<SourceRow, 'source' | 'name'>,
): Promise<boolean> {
  if (source.kind === 'template') {
    const document = await settle(api, 'Could not read a 템플릿', () =>
      api.templates.get(source.id),
    );
    if (document === undefined || document === null) return false;
    const result = await settle(api, 'Could not rename a 템플릿', () =>
      api.content.edit({
        type: 'template.update',
        template: {...document.template, name},
        baseRevision: document.revision,
      }),
    );
    return result?.ok === true;
  }
  return renameService(api, source.id, name);
}

async function deleteSource(
  api: SourceActionsApi,
  source: NamedSource,
): Promise<boolean> {
  const result = await settle(api, 'Could not delete a service source', () =>
    api.content.edit(
      source.kind === 'template'
        ? {type: 'template.delete', templateId: source.id}
        : {type: 'service.delete', serviceId: source.id},
    ),
  );
  return result !== undefined && editApplied(result);
}

/**
 * The right-click menu of the 템플릿 and 예배 순서 rows in the service dialogs:
 * 이름 바꾸기 and 삭제, with their dialogs. The open 예배 순서 can't be deleted.
 * `overlays` renders the menu and the dialog that is open.
 */
export function useSourceActions({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): {
  readonly openMenu: (event: ContextMenuEvent, row: SourceRow) => void;
  readonly overlays: ReactNode;
  readonly confirmDelete: (row: SourceRow) => void;
  readonly onHistoryKey: (event: KeyboardEvent<HTMLDivElement>) => void;
} {
  const api = window.llp;
  const currentId = useShow(view => view.serviceId);
  const [menu, setMenu] = useState<{
    readonly row: SourceRow;
    readonly anchor: MenuAnchor;
  } | null>(null);
  const [dialog, setDialog] = useState<{
    readonly kind: 'rename';
    readonly row: SourceRow;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLElement>(null);
  const history = api ? contentDeleteHistory(api.content) : null;
  const historyState = useSyncExternalStore(
    history?.subscribe ?? noSubscribe,
    history?.get ?? noHistory,
  );
  const renameAfterMenu = useMenuHandoff<SourceRow>(menu !== null, row =>
    setDialog({kind: 'rename', row}),
  );
  const alive = useAlive();

  const run = (
    action: keyof typeof problemTitles,
    work: (api: SourceActionsApi) => Promise<boolean>,
  ): Promise<boolean> => {
    if (api === undefined || busy) return Promise.resolve(false);
    setBusy(true);
    return pendingWritesOf(api)
      .run({write: () => work(api), refused: false, sent: done => done})
      .then(done => {
        if (!alive.current) return false;
        setBusy(false);
        if (done) {
          setDialog(null);
          return true;
        }
        onProblem(
          warningNotice(`source-actions:${action}`, problemTitles[action]),
        );
        return false;
      })
      .catch((cause: unknown) => {
        console.error('Failed to finish a service source action:', cause);
        if (alive.current) setBusy(false);
        return false;
      });
  };

  // NOTE(0913vision): The rename and delete dialogs stay until their edit
  // answers, so its result is never dropped.
  const closeDialog = (): void => {
    if (!busy) setDialog(null);
  };
  const openMenu = (event: ContextMenuEvent, row: SourceRow): void => {
    event.preventDefault();
    root.current = event.currentTarget.closest<HTMLElement>('[role="listbox"]');
    setMenu({row, anchor: contextMenuAnchor(event)});
  };
  const isOpen = (row: SourceRow): boolean =>
    row.source.kind === 'service' && row.source.id === currentId;
  const remove = (row: SourceRow): void => {
    deleteSelection(
      1,
      () => !busy && row.access === 'editable' && !isOpen(row),
      () => {
        focusHistorySurface(root.current);
        run('delete', async next => {
          const done = await deleteSource(next, row.source);
          if (done) history?.record(row.source.kind, row.source.id);
          return done;
        }).catch((cause: unknown) =>
          console.error('Could not finish deleting a service source:', cause),
        );
      },
    );
  };
  const deleteAfterMenu = useMenuHandoff<SourceRow>(menu !== null, remove);
  const readOnlyReason =
    menu?.row.access === 'readOnly' ? NEWER_FILE_REASON : undefined;

  const overlays = (
    <>
      {menu === null ? null : (
        <Menu
          context
          label={`${menu.row.name} ${kindName(menu.row.source)}`}
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={[
            {
              kind: 'item',
              id: 'rename',
              label: '이름 바꾸기',
              ...menuAvailability(readOnlyReason),
              onSelect: () => {
                setMenu(null);
                renameAfterMenu(menu.row);
              },
            },
            {
              kind: 'item',
              id: 'delete',
              contextGroup: 'delete',
              label: '삭제',
              danger: true,
              ...menuAvailability(
                readOnlyReason ?? (isOpen(menu.row) ? OPEN_SERVICE : undefined),
              ),
              onSelect: () => {
                setMenu(null);
                deleteAfterMenu(menu.row);
              },
            },
          ]}
        />
      )}
      {dialog?.kind === 'rename' ? (
        <RenameDialog
          name={dialog.row.name}
          title={
            dialog.row.source.kind === 'template'
              ? '템플릿 이름 바꾸기'
              : '예배 이름 바꾸기'
          }
          locked={busy}
          rename={{
            onCommit: name =>
              run('rename', next =>
                renameSource(next, {source: dialog.row.source, name}),
              ),
            onClose: closeDialog,
          }}
        />
      ) : null}
    </>
  );
  return {
    openMenu,
    overlays,
    confirmDelete: remove,
    onHistoryKey: event => {
      const kind = historyKey(event);
      if (kind === null || historyState.busy || historyState[kind] === 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      history
        ?.replay(kind)
        .catch((cause: unknown) =>
          console.error('Could not restore a service source:', cause),
        );
    },
  };
}
