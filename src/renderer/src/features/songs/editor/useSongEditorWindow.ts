import {titleSlidesForCopy} from '@core/songs/newSongTitle';
import {createSongId} from '@core/schema/ids';
import {loadItemSong, itemSongContent} from './itemSongSession';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SongId} from '@core/schema/ids';
import type {SongEditorTarget} from '@core/schema/ipcPayloads';
import {withServiceItemSong} from '@core/songs/itemSong';
import {copyTitle} from '@core/songs/songTitle';
import {
  pendingWritesOf,
  type DraftOutcome,
} from '@renderer/platform/pendingWrites';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {SongEditorStore} from './songEditorStore';

const PROBLEMS = {
  open: '곡 열기 실패',
  missing: '곡을 찾을 수 없습니다',
  saveAs: '다른 이름으로 저장 실패',
  item: '새 곡으로 바꾸기 실패',
} as const;

/** The question the window asks about unsaved edits. */
export type SongSaveDialog =
  | {readonly kind: 'overwrite'}
  | {readonly kind: 'saveAs'}
  | {
      readonly kind: 'leave';
      readonly proceed: () => void;
      readonly cancel?: (() => void) | undefined;
    };

function problem(key: keyof typeof PROBLEMS): Notice {
  return {
    key: `song-window:${key}`,
    kind: 'warning',
    icon: 'warning',
    title: PROBLEMS[key],
    time: noticeTime(),
  };
}

async function switchItemSong(
  api: LlpApi,
  from: NonNullable<SongEditorTarget['from']>,
  songId: SongId,
): Promise<boolean> {
  const document = await api.services.get(from.serviceId);
  if (document === null) return false;
  const service = withServiceItemSong(document.service, from.itemId, songId);
  if (service === null) return false;
  const result = await api.content.edit({
    type: 'service.update',
    service,
    baseRevision: document.revision,
  });
  return result.ok;
}

/**
 * The 곡 편집 window's state: the song it shows, the target it follows, and
 * the questions of 저장, 다른 이름으로 저장…, and leaving with unsaved edits.
 */
export function useSongEditorWindow(
  store: SongEditorStore,
  api: LlpApi,
  {
    report,
    onOpened,
    beforeLeave,
  }: {
    readonly report: (notice: Notice) => void;
    readonly onOpened?: (target: SongEditorTarget) => void;
    readonly beforeLeave?:
      ((proceed: () => void, cancel?: () => void) => void) | undefined;
  },
) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [dialog, setDialog] = useState<SongSaveDialog | null>(null);
  const [saving, setSaving] = useState(false);
  const shown = useRef(dialog);
  useLayoutEffect(() => {
    shown.current = dialog;
  });
  const from = useRef<SongEditorTarget['from']>(undefined);
  const targetSource = useRef<SongEditorTarget | null>(null);
  const openSerial = useRef(0);
  const busy = useRef(false);
  const live = useRef(state);
  useLayoutEffect(() => {
    live.current = state;
    const target = targetSource.current;
    const id =
      target?.from === undefined
        ? target?.songId
        : createSongId(target.from.itemId);
    if (target !== null && id !== state.session?.document.song.id) {
      from.current = undefined;
      targetSource.current = null;
    }
  });

  const askLeave = (proceed: () => void, cancel?: () => void): void => {
    const ask = (): void => {
      if (store.getSnapshot().session?.unsaved === true) {
        const open = shown.current;
        if (open?.kind === 'leave') open.cancel?.();
        shown.current = {kind: 'leave', proceed, cancel};
        setDialog(shown.current);
      } else proceed();
    };
    if (beforeLeave === undefined) ask();
    else beforeLeave(ask, cancel);
  };

  const openTarget = async (target: SongEditorTarget): Promise<void> => {
    const serial = ++openSerial.current;
    try {
      const origin = target.from;
      const reload = () =>
        origin === undefined
          ? api.songs.get(target.songId)
          : loadItemSong(api, origin, target.songId);
      const document = await reload();
      if (serial !== openSerial.current) return;
      if (document === null) {
        report(problem('missing'));
        return;
      }
      let content: LlpApi['content'] | undefined;
      if (origin !== undefined) {
        content = itemSongContent(api, origin, target.songId);
      }
      from.current = target.from;
      targetSource.current = target;
      store.open(document, {
        ...(target.focusTitle === true ? {focusTitle: true} : {}),
        ...(target.block === undefined ? {} : {block: target.block}),
        ...(content === undefined ? {} : {content, reload}),
        action: target.action,
      });
      if (store.getSnapshot().session?.document.song.id === document.song.id) {
        onOpened?.(target);
      }
    } catch (error) {
      console.error('Could not open the song', error);
      report(problem('open'));
    }
  };

  const follow = (target: SongEditorTarget | null): void => {
    if (target === null) return;
    const current = live.current.session?.document.song.id;
    const key =
      target.from === undefined
        ? target.songId
        : createSongId(target.from.itemId);
    if (current === key) {
      openTarget(target).catch(() => undefined);
      return;
    }
    askLeave(() => {
      if (store.getSnapshot().imported) store.discardImported();
      else if (
        current !== undefined &&
        store.sessionOf(current)?.unsaved === true
      ) {
        store.discardEdits(current);
      }
      openTarget(target).catch(() => undefined);
    });
  };
  const followLatest = useRef(follow);
  useLayoutEffect(() => {
    followLatest.current = follow;
  });

  useEffect(() => {
    let current = true;
    api.songEditorWindow
      .target()
      .then(target => {
        if (current) followLatest.current(target);
      })
      .catch((error: unknown) => console.error('No song target', error));
    const stop = api.songEditorWindow.onRetarget(target =>
      followLatest.current(target),
    );
    return () => {
      current = false;
      stop();
    };
  }, [api]);

  useEffect(
    () =>
      api.services.subscribe(change => {
        const target = targetSource.current;
        const origin = target?.from;
        if (target === null || origin?.serviceId !== change.serviceId) return;
        const session = store.sessionOf(createSongId(origin.itemId));
        if (session === undefined) return;
        const serial = openSerial.current;
        loadItemSong(api, origin, target.songId)
          .then(document => {
            if (serial !== openSerial.current) return;
            if (document !== null) store.receiveDocument(document);
            else session.blocked = true;
          })
          .catch((error: unknown) =>
            console.error('Could not refresh item slides', error),
          );
      }),
    [api, store],
  );

  const askLeaveLatest = useRef(askLeave);
  useLayoutEffect(() => {
    askLeaveLatest.current = askLeave;
  });
  useEffect(() => {
    store.setLeaveGuard(action =>
      askLeaveLatest.current(() => {
        const current = store.getSnapshot().session;
        if (store.getSnapshot().imported) store.discardImported();
        else if (current?.unsaved === true) {
          store.discardEdits(current.document.song.id);
        }
        action();
      }),
    );
    return () => store.setLeaveGuard(undefined);
  }, [store]);
  useEffect(
    () =>
      pendingWritesOf(api).addDraft(
        () =>
          new Promise<DraftOutcome>(resolve => {
            askLeaveLatest.current(
              () => {
                if (store.getSnapshot().imported) store.discardImported();
                resolve('settled');
              },
              () => resolve('canceled'),
            );
          }),
        error => console.error('Could not settle the song edits', error),
      ),
    [api, store],
  );

  const session = state.session;
  const guarded = async (work: () => Promise<boolean>): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    try {
      return await work();
    } catch (error) {
      console.error('Song save failed', error);
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const overwrite = (): Promise<boolean> =>
    guarded(async () => {
      if (live.current.imported) return store.saveImported({kind: 'new'});
      return (await session?.commit()) === true;
    });

  const saveAs = (title: string): Promise<boolean> =>
    guarded(async () => {
      if (session === null) return false;
      if (from.current !== undefined && !(await session.commit())) return false;
      const source = session.draftSong();
      const draft = {
        ...source,
        title,
        slides: titleSlidesForCopy(source, title, () => crypto.randomUUID()),
      };
      const result = await api.content.edit({type: 'song.saveAs', song: draft});
      if (!result.ok) {
        report(problem('saveAs'));
        return false;
      }
      const created = await api.songs.get(result.value.id);
      if (created === null) {
        report(problem('saveAs'));
        return false;
      }
      const origin = from.current;
      if (
        origin !== undefined &&
        !(await switchItemSong(api, origin, created.song.id))
      ) {
        report(problem('item'));
      }
      store.discardEdits(session.document.song.id);
      from.current = undefined;
      targetSource.current = null;
      setDialog(null);
      store.open(created);
      return true;
    });

  const close = (): void => {
    if (dialog?.kind === 'leave') dialog.cancel?.();
    setDialog(null);
  };
  const askOverwrite = (): void => {
    if (
      session?.unsaved === true &&
      session.title.reason === undefined &&
      !session.readOnly
    ) {
      setDialog({kind: 'overwrite'});
    }
  };
  const askSaveAs = (): void => {
    if (session !== null) setDialog({kind: 'saveAs'});
  };
  useWindowShortcuts([
    {
      id: 'songWindow.save',
      context: 'song',
      when: () => !state.imported && state.session !== null,
      run: askOverwrite,
    },
    {
      id: 'songWindow.saveAs',
      context: 'song',
      when: () => !state.imported && state.session !== null,
      run: askSaveAs,
    },
  ]);

  return {
    state,
    session,
    dialog,
    saving,
    suggestedName: copyTitle(
      session?.title.nextValue ?? '',
      state.library.map(entry => entry.title),
    ),
    close,
    askOverwrite,
    askSaveAs,
    confirmOverwrite: (): void => {
      overwrite()
        .then(saved => {
          if (saved) setDialog(null);
        })
        .catch(() => undefined);
    },
    commitSaveAs: saveAs,
    saveAndLeave: (proceed: () => void): void => {
      overwrite()
        .then(saved => {
          if (!saved) return;
          setDialog(null);
          proceed();
        })
        .catch(() => undefined);
    },
    discardAndLeave: (proceed: () => void): void => {
      setDialog(null);
      proceed();
    },
  };
}

export type SongEditorWindowModel = ReturnType<typeof useSongEditorWindow>;
