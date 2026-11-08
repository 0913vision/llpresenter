import {useCallback, useEffect, useRef, useState, type JSX} from 'react';
import {DisplayLayout} from '@renderer/features/screens/DisplayLayout';
import {OutputPreview} from '@renderer/features/screens/OutputPreview';
import {ScreenList} from '@renderer/features/screens/ScreenList';
import {ScreenProperties} from '@renderer/features/screens/ScreenProperties';
import {ScreenSummariesProvider} from '@renderer/platform/ScreenSummaries';
import {IconButton} from '@renderer/ui';
import {watchInputModality} from '@renderer/ui/inputModality';
import {NotificationStack} from '@renderer/ui/Notification';
import {addNotice, removeNotice, type Notice} from '@renderer/ui/notices';
import {Panel} from './shell/WorkspacePanel';
import panelStyles from './shell/Workspace.module.css';
import styles from './ScreensWindow.module.css';
import type {CloseFlush} from './closeFlush';
import {SavingDialog} from './SavingDialog';
import {useClearKeys} from '@renderer/features/presentation/clearKeys';
import {useLiveStateShortcuts} from '@renderer/features/tools/useLiveStateShortcuts';
import {useUiZoomKeys} from './shell/uiZoomKeys';
import {useInitialListFocus} from './useWindowKeyboard';
import {useShortcutSettings} from '@renderer/platform/useShortcutSettings';
import {
  LoadReadiness,
  LoadReadinessContext,
  usePaintedReadiness,
} from '@renderer/ui/loadReadiness';
import {useCloseKeys} from './useWindowKeyboard';

interface ScreensWindowProps {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly closeFlush?: CloseFlush | undefined;
  readonly onReady?: (() => void) | undefined;
  readonly preparing?: boolean | undefined;
  readonly requestId?: number | undefined;
}

/** The screen and monitor settings, separate from the theme workspace. */
export function ScreensWindow(props: ScreensWindowProps): JSX.Element {
  const [readiness] = useState(() => new LoadReadiness());
  return (
    <LoadReadinessContext value={readiness}>
      <ScreensContent {...props} readiness={readiness} />
    </LoadReadinessContext>
  );
}

function ScreensContent({
  onProblem,
  closeFlush,
  onReady,
  preparing = false,
  requestId,
  readiness,
}: ScreensWindowProps & {readonly readiness: LoadReadiness}): JSX.Element {
  usePaintedReadiness(readiness, onReady);
  const close = useCallback(() => window.llp?.window.control('close'), []);
  useCloseKeys(close);
  const [notices, setNotices] = useState<readonly Notice[]>([]);
  useShortcutSettings(window.llp);
  useClearKeys();
  useLiveStateShortcuts();
  useUiZoomKeys();
  const body = useRef<HTMLElement>(null);
  useInitialListFocus(body, requestId);
  const report = useCallback(
    (notice: Notice) => {
      setNotices(current => addNotice(current, notice));
      onProblem?.(notice);
    },
    [onProblem],
  );
  useEffect(() => watchInputModality(window), []);
  return (
    <ScreenSummariesProvider onProblem={report}>
      <div className={styles.window} data-workspace-layout="screens">
        <header className={styles.titlebar}>
          <span>화면 설정</span>
          <div className={styles.controls}>
            <IconButton
              icon="min"
              label="최소화"
              onClick={() => window.llp?.window.control('minimize')}
            />
            <IconButton
              icon="x"
              label="닫기"
              onClick={() => window.llp?.window.control('close')}
            />
          </div>
        </header>
        <main
          ref={body}
          className={`${styles.columns} ${panelStyles.screenSettings}`}
          aria-label="화면 설정"
        >
          <div className={styles.column}>
            <Panel
              title="화면"
              parts={{body: <ScreenList onProblem={report} />}}
            />
          </div>
          <div className={styles.column}>
            <Panel
              title="배치"
              parts={{body: <DisplayLayout onProblem={report} />}}
            />
            <Panel
              title="출력 미리보기"
              parts={{
                body: (
                  <OutputPreview
                    onProblem={report}
                    pictureEnabled={!preparing}
                  />
                ),
              }}
            />
          </div>
          <div className={styles.column}>
            <Panel
              title="속성"
              parts={{body: <ScreenProperties onProblem={report} />}}
            />
          </div>
        </main>
        <NotificationStack
          notices={notices}
          onClose={key => setNotices(current => removeNotice(current, key))}
        />
        {closeFlush === undefined ? null : (
          <SavingDialog closeFlush={closeFlush} />
        )}
      </div>
    </ScreenSummariesProvider>
  );
}
