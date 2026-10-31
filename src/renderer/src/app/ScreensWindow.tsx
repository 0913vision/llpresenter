import {useCallback, useEffect, useState, type JSX} from 'react';
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

/** The screen and monitor settings, separate from the theme workspace. */
export function ScreensWindow({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const [notices, setNotices] = useState<readonly Notice[]>([]);
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
      <div className={styles.window}>
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
              parts={{body: <OutputPreview onProblem={report} />}}
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
      </div>
    </ScreenSummariesProvider>
  );
}
