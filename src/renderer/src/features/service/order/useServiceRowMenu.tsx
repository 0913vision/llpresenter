import {warningNotice} from '@renderer/ui/popups/notices';
import {useMenuHandoff} from '@renderer/ui/menus/useMenuHandoff';
import {useState} from 'react';
import type {ServiceEntry} from '@core/schema/services/contentDocuments';
import {useShow} from '@renderer/session/show';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {
  duplicateService,
  renameService,
} from '@renderer/features/service/list/serviceEdits';
import {useSourceActions} from '@renderer/features/service/list/useSourceActions';
import {useSaveTemplate} from '@renderer/features/service/list/useSaveTemplate';
import {SaveTemplatePrompt} from '@renderer/features/service/list/SaveTemplatePrompt';
import {SaveTemplateDialog} from '@renderer/features/service/list/SaveTemplateDialog';
import {Menu, type MenuAnchor} from '@renderer/ui/menus/Menu';
import type {RenameContract} from '@renderer/ui/fields/useRenameDraft';
import type {Notice} from '@renderer/ui/popups/notices';
import {serviceRowMenuEntries} from './serviceRowMenu';
import {useAlive} from '@renderer/ui/useAlive';

export function useServiceRowMenu(
  onProblem: (notice: Notice) => void,
  closePicker: () => void,
  open?: (entry: ServiceEntry) => void,
) {
  const currentId = useShow(view => view.serviceId);
  const [menu, setMenu] = useState<{
    entry: ServiceEntry;
    anchor: MenuAnchor;
  } | null>(null);
  const [renaming, setRenaming] = useState<ServiceEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useAlive();
  const sources = useSourceActions({onProblem});
  const saver = useSaveTemplate({onProblem});
  const renameAfterMenu = useMenuHandoff(menu !== null, setRenaming);
  const commit = async (
    entry: ServiceEntry,
    value: string,
  ): Promise<boolean> => {
    const api = window.llp;
    const name = value.trim();
    if (!api || busy || !name) return false;
    setBusy(true);
    return pendingWritesOf(api)
      .run({
        write: () => renameService(api, entry.id, name),
        refused: false,
        sent: done => done,
      })
      .then(done => {
        if (alive.current && !done) {
          onProblem(warningNotice('service-row:rename', '이름 바꾸기 실패'));
        }
        return done;
      })
      .catch((cause: unknown) => {
        console.error('Could not finish renaming a service:', cause);
        return false;
      })
      .finally(() => {
        if (alive.current) setBusy(false);
      });
  };
  const copy = (entry: ServiceEntry): void => {
    const api = window.llp;
    if (!api || busy) return;
    setBusy(true);
    pendingWritesOf(api)
      .run({
        write: () => duplicateService(api, entry.id),
        refused: false,
        sent: done => done,
      })
      .then(done => {
        if (!done) {
          onProblem(warningNotice('service-row:duplicate', '예배 복제 실패'));
        }
      })
      .catch((cause: unknown) => {
        console.error('Could not copy a service:', cause);
      })
      .finally(() => {
        setBusy(false);
      });
  };
  const renameFor = (entry: ServiceEntry): RenameContract | undefined =>
    renaming?.id !== entry.id
      ? undefined
      : {
          onCommit: name => commit(entry, name),
          onClose: () => setRenaming(null),
        };
  const overlays = (
    <>
      {menu ? (
        <Menu
          context
          label="예배 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={serviceRowMenuEntries({
            entry: menu.entry,
            activate: open === undefined ? undefined : () => open(menu.entry),
            currentId,
            busy: busy || saver.busy,
            rename: () => renameAfterMenu(menu.entry),
            save: () => {
              closePicker();
              saver.saveService(menu.entry);
            },
            duplicate: () => {
              copy(menu.entry);
            },
            remove: () => {
              closePicker();
              sources.confirmDelete({
                source: {kind: 'service', id: menu.entry.id},
                name: menu.entry.name,
                access: menu.entry.access,
              });
            },
          })}
        />
      ) : null}
      {sources.overlays}
      {saver.naming === null ? null : (
        <SaveTemplateDialog
          name={saver.naming.name}
          busy={saver.busy}
          onSave={saver.saveNamed}
          onCancel={saver.cancel}
        />
      )}
      {saver.conflict ? (
        <SaveTemplatePrompt
          conflict={saver.conflict}
          busy={saver.busy}
          onSaveNew={saver.saveNew}
          onOverwrite={saver.overwrite}
          onCancel={saver.cancel}
        />
      ) : null}
    </>
  );
  return {
    overlays,
    renameFor,
    openMenu: (entry: ServiceEntry, anchor: MenuAnchor): void =>
      setMenu({entry, anchor}),
    cancelRename: (): void => {
      renameAfterMenu(null);
      setRenaming(null);
      setMenu(null);
    },
  };
}
