import type {JSX} from 'react';
import {
  DUPLICATE_TITLE_REASON,
  normalizeSongTitle,
  SONG_TITLE_LIMIT,
} from '@core/songs/songTitle';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {usageMeta} from '@renderer/ui/usageText';
import {RenameDialog} from '@renderer/ui/RenameDialog';
import type {SongEditorWindowModel} from './useSongEditorWindow';

/** The questions of 저장, 다른 이름으로 저장…, and leaving with unsaved edits. */
export function SongSaveDialogs({
  model,
}: {
  readonly model: SongEditorWindowModel;
}): JSX.Element | null {
  const {dialog, session, saving, state} = model;
  if (dialog === null || session === null) return null;
  const title = session.title.nextValue;
  if (dialog.kind === 'saveAs') {
    const taken = new Set(
      state.library
        .filter(entry => entry.id !== session.document.song.id)
        .map(entry => normalizeSongTitle(entry.title)),
    );
    return (
      <RenameDialog
        title="다른 이름으로 저장"
        label="곡 제목"
        name={model.suggestedName}
        maxLength={SONG_TITLE_LIMIT}
        rename={{
          commitsUnchanged: true,
          validate: name =>
            taken.has(normalizeSongTitle(name))
              ? DUPLICATE_TITLE_REASON
              : undefined,
          onCommit: model.commitSaveAs,
          onClose: model.close,
        }}
      />
    );
  }
  if (dialog.kind === 'overwrite') {
    const used =
      state.library.find(entry => entry.id === session.document.song.id)?.usedBy
        .length ?? 0;
    return (
      <AlertDialog
        icon="song"
        title={
          session.itemSession
            ? `‘${title}’ 항목의 변경을 저장할까요?`
            : `‘${title}’ 곡을 덮어쓸까요?`
        }
        meta={
          session.itemSession
            ? ['이번 예배의 슬라이드에 적용됩니다.']
            : usageMeta(used, '예배')
        }
        onCancel={model.close}
        actions={[
          {
            label: session.itemSession ? '저장' : '덮어쓰기',
            primary: true,
            disabled: saving,
            onSelect: model.confirmOverwrite,
          },
        ]}
      />
    );
  }
  return (
    <AlertDialog
      icon="song"
      title={`‘${title}’ ${session.itemSession ? '항목' : '곡'}의 변경을 저장할까요?`}
      onCancel={model.close}
      actions={[
        {
          label: '저장 안 함',
          disabled: saving,
          onSelect: () => model.discardAndLeave(dialog.proceed),
        },
        {
          label: '저장',
          primary: true,
          disabled: saving,
          onSelect: () => model.saveAndLeave(dialog.proceed),
        },
      ]}
    />
  );
}
