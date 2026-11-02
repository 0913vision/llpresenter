import {useEffect, useSyncExternalStore, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {useSongEditorWindow} from '@renderer/features/songs/editor/useSongEditorWindow';
import {SongWindowLayout} from '@renderer/features/songs/editor/windowLayout';
import {useShortcutSettings} from '@renderer/platform/useShortcutSettings';
import {IconButton} from '@renderer/ui';
import {watchInputModality} from '@renderer/ui/inputModality';
import {NotificationStack} from '@renderer/ui/Notification';
import type {ControlSession} from './controlSession';
import {SavingDialog} from './SavingDialog';
import styles from './SongEditorWindow.module.css';

function SongEditorWindowBody({
  session,
  api,
  editor,
}: {
  readonly session: ControlSession;
  readonly api: LlpApi;
  readonly editor: SongEditorStore;
}): JSX.Element {
  const notices = useSyncExternalStore(session.subscribe, session.getNotices);
  const model = useSongEditorWindow(editor, api, session.report);
  useShortcutSettings(api);
  useEffect(() => watchInputModality(window), []);
  return (
    <div className={styles.window} data-workspace-layout="song">
      <header className={styles.titlebar}>
        <span>곡 편집</span>
        <div className={styles.controls}>
          <IconButton
            icon="min"
            label="최소화"
            onClick={() => api.window.control('minimize')}
          />
          <IconButton
            icon="x"
            label="닫기"
            onClick={() => api.window.control('close')}
          />
        </div>
      </header>
      <SongWindowLayout store={editor} model={model} />
      <NotificationStack notices={notices} onClose={session.dismiss} />
      {session.closeFlush === undefined ? null : (
        <SavingDialog closeFlush={session.closeFlush} />
      )}
    </div>
  );
}

/** The 곡 편집 window: a 라이브러리 song edited until 저장. */
export function SongEditorWindow({
  session,
}: {
  readonly session: ControlSession;
}): JSX.Element | null {
  const {api, editor} = session;
  if (api === undefined || editor === undefined) return null;
  return <SongEditorWindowBody session={session} api={api} editor={editor} />;
}
