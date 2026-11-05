import {useEffect, useSyncExternalStore, type JSX} from 'react';
import {SlidesEditor} from '@renderer/features/service/slides/SlidesEditor';
import {useSlidesEditor} from '@renderer/features/service/slides/useSlidesEditor';
import {IconButton} from '@renderer/ui';
import {NotificationStack} from '@renderer/ui/Notification';
import {watchInputModality} from '@renderer/ui/inputModality';
import type {LlpApi} from '@contracts/ipc/api';
import type {ControlSession} from './controlSession';
import {SavingDialog} from './SavingDialog';
import styles from './SongEditorWindow.module.css';

function SlidesWindowBody({
  session,
  api,
}: {
  readonly session: ControlSession;
  readonly api: LlpApi;
}): JSX.Element {
  const model = useSlidesEditor(api, session.report);
  const notices = useSyncExternalStore(session.subscribe, session.getNotices);
  useEffect(() => watchInputModality(window), []);
  return (
    <div className={styles.window} data-workspace-layout="slides">
      <header className={styles.titlebar}>
        <span>슬라이드 편집</span>
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
      <SlidesEditor api={api} model={model} />
      <NotificationStack notices={notices} onClose={session.dismiss} />
      {session.closeFlush === undefined ? null : (
        <SavingDialog closeFlush={session.closeFlush} />
      )}
    </div>
  );
}

export function SlidesEditorWindow({
  session,
}: {
  readonly session: ControlSession;
}): JSX.Element | null {
  return session.api === undefined ? null : (
    <SlidesWindowBody session={session} api={session.api} />
  );
}
