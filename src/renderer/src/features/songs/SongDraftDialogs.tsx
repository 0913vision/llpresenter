import type {JSX} from 'react';
import type {SongDocument} from '@core/schema/contentDocuments';
import {SONG_IMPORT_LIMITS} from '@core/schema/songImport';
import {
  DUPLICATE_TITLE_REASON,
  normalizeSongTitle,
  SONG_TITLE_LIMIT,
} from '@core/songs/songTitle';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {countedMeta} from '@renderer/ui/countedMeta';
import {RenameDialog} from '@renderer/ui/RenameDialog';
import {usageMeta} from '@renderer/ui/usageText';
import {
  ask,
  closeSongDraft,
  editSongTitle,
  overwriteSong,
  saveNewSong,
  saveSongAs,
  suggestedCopyTitle,
  useSongDraft,
} from './songDraft';

function unusedTitle(title: string, taken: ReadonlySet<string>): string | null {
  let number = 2;
  while (taken.has(`${title} (${number})`)) number++;
  const value = `${title} (${number})`;
  return value.length <= SONG_IMPORT_LIMITS.name ? value : null;
}

function run(work: Promise<boolean>, done: () => void): void {
  work.then(
    ok => {
      if (ok) done();
    },
    (error: unknown) => console.error('Could not save the song', error),
  );
}

/** A song with the same name is in the library already. */
function TakenDialog({
  document,
}: {
  readonly document: SongDocument;
}): JSX.Element {
  const saving = useSongDraft(view => view.saving);
  const library = useSongDraft(view => view.library);
  const title = useSongDraft(view =>
    normalizeSongTitle(view.draft?.song.title ?? ''),
  );
  const other = unusedTitle(
    title,
    new Set(library.map(entry => normalizeSongTitle(entry.title))),
  );
  const close = (): void => ask(null);
  const readOnly = document.access === 'readOnly';
  const {updatedAt, slides} = document.song;
  return (
    <AlertDialog
      icon="song"
      title={`‘${title}’ 곡이 이미 있습니다. 덮어쓸까요?`}
      meta={[
        '곡',
        ...countedMeta(slides.length, `슬라이드 ${slides.length}개`),
        ...(other === null ? [] : [`새 제목: ‘${other}’`]),
        ...(updatedAt === undefined
          ? []
          : [
              `${new Date(updatedAt).toLocaleDateString('ko-KR', {month: 'long', day: 'numeric'})} 수정`,
            ]),
      ]}
      onCancel={close}
      actions={[
        {
          label: '새 곡으로 저장',
          disabled: saving || other === null,
          title: other === null ? '새 곡 제목이 너무 깁니다' : undefined,
          onSelect: () => {
            if (other === null) return;
            editSongTitle(other);
            run(saveNewSong({kind: 'new'}), close);
          },
        },
        {
          label: '덮어쓰기',
          primary: true,
          disabled: saving || readOnly,
          title: readOnly ? NEWER_FILE_REASON : undefined,
          onSelect: () =>
            run(
              saveNewSong({
                kind: 'overwrite',
                songId: document.song.id,
                baseRevision: document.revision,
              }),
              close,
            ),
        },
      ]}
    />
  );
}

/** The questions of saving the open song, and of leaving it unsaved. */
export function SongDraftDialogs(): JSX.Element | null {
  const {draft, question, saving, library} = useSongDraft();
  if (question === null || draft === null) return null;
  const close = (): void => ask(null);
  const title = draft.song.title;
  switch (question.kind) {
    case 'taken':
      return <TakenDialog document={question.document} />;
    case 'saveAs': {
      const taken = new Set(
        library
          .filter(entry => entry.id !== draft.song.id)
          .map(entry => normalizeSongTitle(entry.title)),
      );
      return (
        <RenameDialog
          title="다른 이름으로 저장"
          label="곡 제목"
          name={suggestedCopyTitle()}
          maxLength={SONG_TITLE_LIMIT}
          rename={{
            commitsUnchanged: true,
            validate: name =>
              taken.has(normalizeSongTitle(name))
                ? DUPLICATE_TITLE_REASON
                : undefined,
            onCommit: saveSongAs,
            onClose: close,
          }}
        />
      );
    }
    case 'overwrite': {
      const used =
        library.find(entry => entry.id === draft.song.id)?.usedBy.length ?? 0;
      return (
        <AlertDialog
          icon="song"
          title={`‘${title}’ 곡을 덮어쓸까요?`}
          meta={usageMeta(used, '예배')}
          onCancel={close}
          actions={[
            {
              label: '덮어쓰기',
              primary: true,
              disabled: saving,
              onSelect: () => run(overwriteSong(), close),
            },
          ]}
        />
      );
    }
    case 'leave': {
      const leave = (): void => {
        closeSongDraft();
        question.proceed();
      };
      return (
        <AlertDialog
          icon="song"
          title={`‘${title}’ 곡의 변경을 저장할까요?`}
          onCancel={close}
          actions={[
            {label: '저장 안 함', disabled: saving, onSelect: leave},
            {
              label: '저장',
              primary: true,
              disabled: saving,
              onSelect: () =>
                run(
                  draft.document === null
                    ? saveNewSong({kind: 'new'})
                    : overwriteSong(),
                  leave,
                ),
            },
          ]}
        />
      );
    }
  }
}
