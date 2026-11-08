import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type Ref,
} from 'react';
import {PreferencesView} from '@renderer/features/preferences/PreferencesView';
import type {PreferencesViewHandle} from '@renderer/features/preferences/PreferencesView';
import type {PreferencePageId} from '@core/schema/preferencePages';
import {useShortcutSettings} from '@renderer/platform/useShortcutSettings';
import type {PreferencesRequest} from '@contracts/ipc/window';
import {IconButton} from '@renderer/ui';
import {watchInputModality} from '@renderer/ui/inputModality';
import {NotificationStack} from '@renderer/ui/Notification';
import {addNotice, removeNotice, type Notice} from '@renderer/ui/notices';
import type {CloseFlush} from './closeFlush';
import type {ControlSession} from './controlSession';
import {SavingDialog} from './SavingDialog';
import {useUiZoomKeys} from './shell/uiZoomKeys';
import {useCloseKeys, useInitialListFocus} from './useWindowKeyboard';
import styles from './PreferencesWindow.module.css';

const TITLE = '환경설정';
const noSubscription = () => () => undefined;

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
  readonly session?: ControlSession | undefined;
  readonly request?: PreferencesRequest | undefined;
  readonly onReady?: ((request: PreferencesRequest) => void) | undefined;
  readonly onPageSelect?: ((page: PreferencePageId) => void) | undefined;
  readonly viewRef?: Ref<PreferencesViewHandle> | undefined;
}): JSX.Element {
  const [localNotices, setNotices] = useState<readonly Notice[]>([]);
  const getLocalNotices = useCallback(() => localNotices, [localNotices]);
  const notices = useSyncExternalStore(
    session?.subscribe ?? noSubscription,
    session?.getNotices ?? getLocalNotices,
  );
  useShortcutSettings(window.llp);
  useUiZoomKeys();
  const body = useRef<HTMLElement>(null);
  const close = useCallback(() => window.llp?.window.control('close'), []);
  const ready = useCallback(
    (request: PreferencesRequest) =>
      window.llp?.window.preferencesReady(request),
    [],
  );
  useCloseKeys(close);
  useInitialListFocus(body, request?.requestId);
  useEffect(() => watchInputModality(window), []);
  const report = useCallback(
    (notice: Notice) => {
      if (session === undefined) {
        setNotices(current => addNotice(current, notice));
      } else session.report(notice);
    },
    [session],
  );
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
          labelStore={session?.editor}
          onReady={onReady ?? ready}
          request={request}
          onPageSelect={onPageSelect}
          viewRef={viewRef}
        />
      </main>
      <NotificationStack
        notices={notices}
        onClose={key => {
          if (session === undefined) {
            setNotices(current => removeNotice(current, key));
          } else session.dismiss(key);
        }}
      />
      {closeFlush === undefined ? null : (
        <SavingDialog closeFlush={closeFlush} />
      )}
    </div>
  );
}
