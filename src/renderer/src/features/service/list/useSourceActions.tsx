import {useEffect, useRef, useState, type ReactNode} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {ServiceEntry} from '@core/schema/contentDocuments';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {useShow} from '@renderer/features/presentation/state/show';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {RenameDialog} from './RenameDialog';
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

const OPEN_SERVICE = '열린 예배 순서는 삭제할 수 없습니다';
const problemTitles = {
  rename: '이름을 바꿀 수 없음',
  delete: '삭제할 수 없음',
} as const;

function kindName(source: NamedSource): string {
  return source.kind === 'template' ? '템플릿' : '예배 순서';
}

function kindObject(source: NamedSource): string {
  return source.kind === 'template' ? '템플릿을' : '예배 순서를';
}

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
    return result !== undefined && editApplied(result);
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
} {
  const api = window.llp;
  const currentId = useShow(view => view.serviceId);
  const [menu, setMenu] = useState<{
    readonly row: SourceRow;
    readonly anchor: MenuAnchor;
  } | null>(null);
  const [dialog, setDialog] = useState<{
    readonly kind: 'rename' | 'delete';
    readonly row: SourceRow;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = (
    action: keyof typeof problemTitles,
    work: (api: SourceActionsApi) => Promise<boolean>,
  ): void => {
    if (api === undefined || busy) return;
    setBusy(true);
    pendingWritesOf(api)
      .run({write: () => work(api), refused: false, sent: done => done})
      .then(done => {
        if (!alive.current) return;
        setBusy(false);
        if (done) {
          setDialog(null);
          return;
        }
        onProblem(
          warningNotice(`source-actions:${action}`, problemTitles[action]),
        );
      })
      .catch((cause: unknown) => {
        console.error('Failed to finish a service source action:', cause);
      });
  };

  // NOTE(0913vision): The rename and delete dialogs stay until their edit
  // answers, so its result is never dropped.
  const closeDialog = (): void => {
    if (!busy) setDialog(null);
  };
  const openMenu = (event: ContextMenuEvent, row: SourceRow): void => {
    event.preventDefault();
    setMenu({row, anchor: contextMenuAnchor(event)});
  };
  const isOpen = (row: SourceRow): boolean =>
    row.source.kind === 'service' && row.source.id === currentId;
  const readOnlyReason =
    menu?.row.access === 'readOnly'
      ? `읽기 전용 ${kindName(menu.row.source)}`
      : undefined;

  const overlays = (
    <>
      {menu === null ? null : (
        <Menu
          label={`${menu.row.name} ${kindName(menu.row.source)}`}
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={[
            {
              kind: 'item',
              id: 'rename',
              label: '이름 바꾸기',
              disabled: readOnlyReason !== undefined,
              title: readOnlyReason,
              onSelect: () => {
                setMenu(null);
                setDialog({kind: 'rename', row: menu.row});
              },
            },
            {
              kind: 'item',
              id: 'delete',
              label: '삭제',
              danger: true,
              disabled: readOnlyReason !== undefined || isOpen(menu.row),
              title:
                readOnlyReason ?? (isOpen(menu.row) ? OPEN_SERVICE : undefined),
              onSelect: () => {
                setMenu(null);
                setDialog({kind: 'delete', row: menu.row});
              },
            },
          ]}
        />
      )}
      {dialog?.kind === 'rename' ? (
        <RenameDialog
          name={dialog.row.name}
          busy={busy}
          onCancel={closeDialog}
          onRename={name =>
            run('rename', next =>
              renameSource(next, {source: dialog.row.source, name}),
            )
          }
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <AlertDialog
          icon="trash"
          title={`‘${dialog.row.name}’ ${kindObject(dialog.row.source)} 삭제할까요?`}
          onCancel={closeDialog}
          actions={[
            {
              label: '삭제',
              primary: true,
              disabled: busy,
              onSelect: () =>
                run('delete', next => deleteSource(next, dialog.row.source)),
            },
          ]}
        />
      ) : null}
    </>
  );
  return {
    openMenu,
    overlays,
    confirmDelete: row => setDialog({kind: 'delete', row}),
  };
}
