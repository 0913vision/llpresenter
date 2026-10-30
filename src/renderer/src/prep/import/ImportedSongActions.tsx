import {useState, useSyncExternalStore, type JSX} from 'react';
import type {SongDocument} from '@core/schema/contentDocuments';
import type {SongId} from '@core/schema/ids';
import {sourceSlideCount} from '@core/schema/groupedSong';
import {SONG_IMPORT_LIMITS} from '@core/schema/songImport';
import {AlertDialog, Button} from '@renderer/ui';
import {useWindowShortcuts} from '@renderer/shell/windowShortcuts';
import {editorTask} from '../editor/editorTask';
import type {SongEditorStore} from '../editor/songEditorStore';
import {EMPTY_TITLE_REASON, normalizeSongTitle} from '../editor/songTitle';

function unusedTitle(title: string, titles: readonly string[]): string | null {
  let number = 2;
  const names = new Set(titles);
  while (names.has(`${title} (${number})`)) number++;
  const value = `${title} (${number})`;
  return value.length <= SONG_IMPORT_LIMITS.name ? value : null;
}

export function ImportedSongActions({
  store,
  onSaved,
}: {
  readonly store: SongEditorStore;
  readonly onSaved?: ((id: SongId) => void) | undefined;
}): JSX.Element | null {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [duplicate, setDuplicate] = useState<SongDocument | null>(null);
  const [reading, setReading] = useState(false);
  const session = state.session;
  const title = normalizeSongTitle(session?.title.value ?? '');
  const invalid =
    title === ''
      ? EMPTY_TITLE_REASON
      : title.length > SONG_IMPORT_LIMITS.name
        ? '곡 제목이 너무 깁니다'
        : undefined;
  const busy = state.busy || reading;
  const libraryReason =
    state.libraryStatus === 'ready'
      ? undefined
      : state.libraryStatus === 'loading'
        ? '곡 목록을 불러오는 중입니다'
        : '곡 목록을 확인할 수 없습니다';
  const unavailable = busy || libraryReason !== undefined;
  const save = async (
    target: Parameters<SongEditorStore['saveImported']>[0],
  ): Promise<void> => {
    if (store.getSnapshot().libraryStatus !== 'ready') return;
    if (await store.saveImported(target)) {
      const id = store.getSnapshot().session?.document.song.id;
      if (id !== undefined) onSaved?.(id);
    } else setDuplicate(null);
  };
  const beginSave = async (): Promise<void> => {
    if (
      !state.imported ||
      session === null ||
      unavailable ||
      invalid !== undefined
    ) {
      return;
    }
    const existing = state.library.find(
      entry => normalizeSongTitle(entry.title) === title,
    );
    if (existing === undefined || session.blocked) {
      await save({kind: 'new'});
      return;
    }
    setReading(true);
    try {
      const document = await store.api.songs.get(existing.id);
      const latest = store.getSnapshot();
      if (
        latest.session !== session ||
        normalizeSongTitle(session.title.value) !== title
      ) {
        return;
      }
      if (latest.libraryStatus !== 'ready') return;
      const match = latest.library.find(
        entry => normalizeSongTitle(entry.title) === title,
      );
      if (
        match?.id !== existing.id ||
        (document !== null && normalizeSongTitle(document.song.title) !== title)
      ) {
        store.reportImportTargetChanged();
        return;
      }
      if (document === null) await save({kind: 'new'});
      else setDuplicate(document);
    } catch (error) {
      console.error('Import overwrite target read failed', error);
      store.reportImportReadFailure();
    } finally {
      setReading(false);
    }
  };
  useWindowShortcuts([
    {
      code: 'KeyS',
      ctrl: true,
      when: () => state.imported,
      run: () => editorTask(beginSave()),
    },
  ]);
  if (!state.imported || session === null) return null;
  const newTitle =
    state.libraryStatus === 'ready'
      ? unusedTitle(
          title,
          state.library.map(entry => normalizeSongTitle(entry.title)),
        )
      : null;
  return (
    <>
      <Button size="sm" disabled={busy} onClick={() => store.discardImported()}>
        버리기
      </Button>
      <Button
        size="sm"
        variant="primary"
        disabled={unavailable || invalid !== undefined}
        title={invalid ?? (busy ? '저장 중' : libraryReason)}
        onClick={() => editorTask(beginSave())}
      >
        저장
      </Button>
      {state.discardRequested ? (
        <AlertDialog
          icon="song"
          title="가져온 곡을 저장하지 않았습니다. 버릴까요?"
          onCancel={() => store.cancelDiscard()}
          actions={[
            {
              label: '버리기',
              primary: true,
              onSelect: () => store.discardImported(),
            },
          ]}
        />
      ) : null}
      {duplicate === null ? null : (
        <AlertDialog
          icon="song"
          title={`‘${title}’ 곡이 이미 있습니다. 덮어쓸까요?`}
          meta={[
            '라이브러리 곡',
            `슬라이드 ${sourceSlideCount(duplicate.song)}개`,
            ...(newTitle === null ? [] : [`새 곡 제목: ‘${newTitle}’`]),
            ...(duplicate.song.updatedAt === undefined
              ? []
              : [
                  `${new Date(duplicate.song.updatedAt).toLocaleDateString('ko-KR', {month: 'long', day: 'numeric'})} 수정`,
                ]),
          ]}
          onCancel={() => {
            if (!busy) setDuplicate(null);
          }}
          actions={[
            {
              label: '새 곡으로 저장',
              disabled: unavailable || newTitle === null,
              title:
                libraryReason ??
                (newTitle === null ? '새 곡 제목이 너무 깁니다' : undefined),
              onSelect: () => {
                if (newTitle === null || unavailable) return;
                session.editTitle(newTitle);
                editorTask(save({kind: 'new'}));
              },
            },
            {
              label: '덮어쓰기',
              primary: true,
              disabled: unavailable || duplicate.access === 'readOnly',
              title:
                duplicate.access === 'readOnly'
                  ? '읽기 전용 곡'
                  : libraryReason,
              onSelect: () =>
                editorTask(
                  save({
                    kind: 'overwrite',
                    songId: duplicate.song.id,
                    baseRevision: duplicate.revision,
                  }),
                ),
            },
          ]}
        />
      )}
    </>
  );
}
