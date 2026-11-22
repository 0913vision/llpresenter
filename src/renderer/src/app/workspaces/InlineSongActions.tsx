import {useMemo, useSyncExternalStore, type JSX, type RefObject} from 'react';
import {useShow} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import type {Notice} from '@renderer/ui/notices';
import {useServiceSongMenu} from '@renderer/features/service/order/useServiceSongMenu';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import type {SongEditorWindowModel} from '@renderer/features/songs/editor/useSongEditorWindow';

export function InlineSongActions({
  store,
  shownSession,
  controlsRef,
  onProblem,
}: {
  readonly store: SongEditorStore;
  readonly shownSession?:
    ReturnType<SongEditorStore['getSnapshot']>['session'] | undefined;
  readonly controlsRef: RefObject<SongEditorWindowModel | null>;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const {
    session: currentSession,
    busy,
    imported,
  } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const session = shownSession === undefined ? currentSession : shownSession;
  const serviceId = useShow(view => view.serviceId);
  const itemId = session?.itemSession ? session.document.song.id : null;
  const target = useMemo(
    () =>
      session?.itemSession && itemId !== null ? {id: itemId, serviceId} : null,
    [session, itemId, serviceId],
  );
  const menu = useServiceSongMenu(target, onProblem, {
    beforeSave: async () => {
      if (session === null || !(await session.flush())) return null;
      return session.document.revision;
    },
  });
  if (session === null || imported) return null;
  if (session.itemSession) {
    return (
      <>
        <Button
          disabled={menu.reason !== undefined || menu.locked || busy}
          title={menu.reason}
          onClick={menu.save}
        >
          라이브러리에 저장…
        </Button>
        {menu.dialog}
      </>
    );
  }
  return (
    <>
      <Button
        disabled={busy || session.readOnly}
        onClick={() => controlsRef.current?.askSaveAs()}
      >
        다른 이름으로 저장…
      </Button>
      <Button
        disabled={
          busy ||
          session.readOnly ||
          !session.unsaved ||
          session.title.reason !== undefined
        }
        title={
          session.title.reason ?? (session.unsaved ? undefined : '변경 없음')
        }
        onClick={() => controlsRef.current?.askOverwrite()}
      >
        저장
      </Button>
    </>
  );
}
