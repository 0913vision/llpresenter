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
import {withServiceItemSong} from '@core/songs/itemOrder';
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
  item: '예배 순서 항목을 새 곡으로 바꾸지 못했습니다',
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
  report: (notice: Notice) => void,
) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [dialog, setDialog] = useState<SongSaveDialog | null>(null);
  const [saving, setSaving] = useState(false);
  const shown = useRef(dialog);
  useLayoutEffect(() => {
    shown.current = dialog;
  });
  const from = useRef<SongEditorTarget['from']>(undefined);
  const busy = useRef(false);
  const live = useRef(state);
  useLayoutEffect(() => {
    live.current = state;
  });

  const askLeave = (proceed: () => void, cancel?: () => void): void => {
    if (live.current.session?.unsaved === true) {
      const open = shown.current;
      if (open?.kind === 'leave') open.cancel?.();
      shown.current = {kind: 'leave', proceed, cancel};
      setDialog(shown.current);
    } else proceed();
  };

  const openTarget = async (target: SongEditorTarget): Promise<void> => {
    try {
      const document = await api.songs.get(target.songId);
      if (document === null) {
        report(problem('missing'));
        return;
      }
      from.current = target.from;
      store.open(document, {
        ...(target.focusTitle === true ? {focusTitle: true} : {}),
        ...(target.block === undefined ? {} : {block: target.block}),
        arrangement: target.arrangement,
        action: target.action,
      });
    } catch (error) {
      console.error('Could not open the song', error);
      report(problem('open'));
    }
  };

  const follow = (target: SongEditorTarget | null): void => {
    if (target === null) return;
    const current = live.current.session?.document.song.id;
    if (current === target.songId) {
      openTarget(target).catch(() => undefined);
      return;
    }
    askLeave(() => {
      if (current !== undefined) store.discardEdits(current);
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

  const askLeaveLatest = useRef(askLeave);
  useLayoutEffect(() => {
    askLeaveLatest.current = askLeave;
  });
  useEffect(
    () =>
      pendingWritesOf(api).addDraft(
        () =>
          new Promise<DraftOutcome>(resolve => {
            askLeaveLatest.current(
              () => resolve('settled'),
              () => resolve('canceled'),
            );
          }),
        error => console.error('Could not settle the song edits', error),
      ),
    [api],
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
      return (await session?.commit()) === true;
    });

  const saveAs = (title: string): Promise<boolean> =>
    guarded(async () => {
      if (session === null) return false;
      const draft = session.draftSong(title);
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
      store.open(created);
      return true;
    });

  const close = (): void => {
    if (dialog?.kind === 'leave') dialog.cancel?.();
    setDialog(null);
  };
  const askOverwrite = (): void => {
    if (session?.unsaved === true) setDialog({kind: 'overwrite'});
  };
  const askSaveAs = (): void => {
    if (session !== null) setDialog({kind: 'saveAs'});
  };
  useWindowShortcuts([
    {id: 'songWindow.save', when: () => true, run: askOverwrite},
    {id: 'songWindow.saveAs', when: () => true, run: askSaveAs},
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
