import {useEffect, useRef, useState} from 'react';
import type {ServiceEntry} from '@core/schema/contentDocuments';
import {useShow} from '@renderer/features/presentation/state/show';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {
  renameService,
  warningNotice,
} from '@renderer/features/service/list/serviceEdits';
import {useSourceActions} from '@renderer/features/service/list/useSourceActions';
import {useSaveTemplate} from '@renderer/features/service/list/useSaveTemplate';
import {SaveTemplatePrompt} from '@renderer/features/service/list/SaveTemplatePrompt';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import type {GroupRename} from '@renderer/ui/ListRow';
import type {Notice} from '@renderer/ui/notices';
import {serviceRowMenuEntries} from './serviceRowMenu';

export function useServiceRowMenu(
  onProblem: (notice: Notice) => void,
  closePicker: () => void,
) {
  const currentId = useShow(view => view.serviceId);
  const [menu, setMenu] = useState<{
    entry: ServiceEntry;
    anchor: MenuAnchor;
  } | null>(null);
  const [pending, setPending] = useState<ServiceEntry | null>(null);
  const [renaming, setRenaming] = useState<ServiceEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const sources = useSourceActions({onProblem});
  const saver = useSaveTemplate({onProblem});
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (menu !== null || pending === null) return undefined;
    const timer = setTimeout(() => {
      setRenaming(pending);
      setPending(null);
    });
    return () => clearTimeout(timer);
  }, [menu, pending]);
  const commit = (entry: ServiceEntry, value: string): void => {
    const api = window.llp;
    const name = value.trim();
    setRenaming(null);
    if (!api || busy || !name || name === entry.name) return;
    setBusy(true);
    pendingWritesOf(api)
      .run({
        write: () => renameService(api, entry.id, name),
        refused: false,
        sent: done => done,
      })
      .then(done => {
        if (alive.current && !done) {
          onProblem(warningNotice('service-row:rename', '이름을 바꿀 수 없음'));
        }
      })
      .catch((cause: unknown) => {
        console.error('Could not finish renaming a service:', cause);
      })
      .finally(() => {
        if (alive.current) setBusy(false);
      });
  };
  const renameFor = (entry: ServiceEntry): GroupRename | undefined =>
    renaming?.id !== entry.id
      ? undefined
      : {
          validate: name => (name.trim() ? undefined : '이름을 입력하세요'),
          onCommit: name => commit(entry, name),
          onCancel: () => setRenaming(null),
        };
  const overlays = (
    <>
      {menu ? (
        <Menu
          label="예배 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={serviceRowMenuEntries({
            entry: menu.entry,
            currentId,
            busy: busy || saver.busy,
            rename: () => setPending(menu.entry),
            save: () => {
              closePicker();
              saver.saveService(menu.entry);
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
      setRenaming(null);
      setPending(null);
      setMenu(null);
    },
  };
}
