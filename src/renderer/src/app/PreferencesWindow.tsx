import {useCallback, useEffect, useRef, useState, type JSX} from 'react';
import {PreferencesView} from '@renderer/features/preferences/PreferencesView';
import {useShortcutSettings} from '@renderer/platform/useShortcutSettings';
import {IconButton} from '@renderer/ui';
import {watchInputModality} from '@renderer/ui/inputModality';
import {NotificationStack} from '@renderer/ui/Notification';
import {addNotice, removeNotice, type Notice} from '@renderer/ui/notices';
import type {CloseFlush} from './closeFlush';
import {SavingDialog} from './SavingDialog';
import {useUiZoomKeys} from './shell/uiZoomKeys';
import {useCloseKeys, useInitialListFocus} from './useWindowKeyboard';
import styles from './PreferencesWindow.module.css';

const TITLE = '환경설정';

/** The 환경설정 window: its own title bar and a close button. */
export function PreferencesWindow({
  closeFlush,
}: {
  readonly closeFlush?: CloseFlush | undefined;
}): JSX.Element {
  const [notices, setNotices] = useState<readonly Notice[]>([]);
  useShortcutSettings(window.llp);
  useUiZoomKeys();
  const body = useRef<HTMLElement>(null);
  const close = useCallback(() => window.llp?.window.control('close'), []);
  useCloseKeys(close);
  useInitialListFocus(body);
  useEffect(() => watchInputModality(window), []);
  const report = useCallback(
    (notice: Notice) => setNotices(current => addNotice(current, notice)),
    [],
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
        <PreferencesView onProblem={report} />
      </main>
      <NotificationStack
        notices={notices}
        onClose={key => setNotices(current => removeNotice(current, key))}
      />
      {closeFlush === undefined ? null : (
        <SavingDialog closeFlush={closeFlush} />
      )}
    </div>
  );
}
