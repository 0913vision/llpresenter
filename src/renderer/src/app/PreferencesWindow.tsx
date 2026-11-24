import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type JSX,
  type Ref,
} from 'react';
import {
  PreferencesView,
  type PreferencesViewHandle,
} from '@renderer/features/preferences/PreferencesView';
import type {PreferencePageId} from '@core/schema/preferencePages';
import {useShortcutSettings} from '@renderer/platform/useShortcutSettings';
import type {PreferencesRequest} from '@contracts/ipc/window';
import {IconButton} from '@renderer/ui';
import {watchInputModality} from '@renderer/ui/keys/inputModality';
import {NotificationStack} from '@renderer/ui/popups/Notification';
import type {Notice} from '@renderer/ui/popups/notices';
import type {CloseFlush} from './closeFlush';
import type {ControlSession} from './controlSession';
import {SavingDialog} from './SavingDialog';
import {useUiZoomKeys} from './shell/uiZoomKeys';
import {useCloseKeys, useInitialListFocus} from './useWindowKeyboard';
import styles from './PreferencesWindow.module.css';

const TITLE = '환경설정';

/** The 환경설정 window: its own title bar and a close button. */
export function PreferencesWindow({
  closeFlush,
  session,
  request,
  onReady,
  onPageSelect,
  viewRef,
}: {
  readonly closeFlush?: CloseFlush | undefined;
  readonly session: ControlSession;
  readonly request: PreferencesRequest | undefined;
  readonly onReady: (request: PreferencesRequest) => void;
  readonly onPageSelect: (page: PreferencePageId) => void;
  readonly viewRef?: Ref<PreferencesViewHandle> | undefined;
}): JSX.Element {
  const notices = useSyncExternalStore(session.subscribe, session.getNotices);
  useShortcutSettings(window.llp);
  useUiZoomKeys();
  const body = useRef<HTMLElement>(null);
  const close = useCallback(() => window.llp?.window.control('close'), []);
  useCloseKeys(close);
  useInitialListFocus(body, request?.requestId);
  useEffect(() => watchInputModality(window), []);
  const report = useCallback(
    (notice: Notice) => session.report(notice),
    [session],
  );
  const dismiss = useCallback((key: string) => session.dismiss(key), [session]);
  return (
    <div className={styles.window} data-workspace-layout="preferences">
      <header className={styles.titlebar}>
        <span>{TITLE}</span>
        <div className={styles.controls}>
          <IconButton icon="x" label="닫기" onClick={close} />
        </div>
      </header>
      <main ref={body} className={styles.body} aria-label={TITLE}>
        <PreferencesView
          onProblem={report}
          onDismiss={dismiss}
          labelStore={session.labels}
          onReady={onReady}
          request={request}
          onPageSelect={onPageSelect}
          viewRef={viewRef}
        />
      </main>
      <NotificationStack notices={notices} onClose={dismiss} />
      {closeFlush === undefined ? null : (
        <SavingDialog closeFlush={closeFlush} />
      )}
    </div>
  );
}
