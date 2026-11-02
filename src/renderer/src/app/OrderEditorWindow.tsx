import {useCallback, useEffect, useState, type JSX} from 'react';
import {OrderEditorTargetView} from '@renderer/features/service/orderEditor/OrderEditorTargetView';
import {
  useOrderEditorLabels,
  useOrderEditorTarget,
} from '@renderer/features/service/orderEditor/useOrderEditorSources';
import {useShortcutSettings} from '@renderer/platform/useShortcutSettings';
import {IconButton} from '@renderer/ui';
import {watchInputModality} from '@renderer/ui/inputModality';
import {NotificationStack} from '@renderer/ui/Notification';
import {addNotice, removeNotice, type Notice} from '@renderer/ui/notices';
import type {CloseFlush} from './closeFlush';
import {SavingDialog} from './SavingDialog';
import {useUiZoomKeys} from './shell/uiZoomKeys';
import styles from './OrderEditorWindow.module.css';

const TITLE = '순서 편집';

function Titlebar(): JSX.Element {
  return (
    <header className={styles.titlebar}>
      <span>{TITLE}</span>
      <div className={styles.controls}>
        <IconButton
          icon="min"
          label="최소화"
          onClick={() => window.llp?.window.control('minimize')}
        />
        <IconButton
          icon="max"
          label="최대화"
          onClick={() => window.llp?.window.control('toggle-maximize')}
        />
        <IconButton
          icon="x"
          label="닫기"
          onClick={() => window.llp?.window.control('close')}
        />
      </div>
    </header>
  );
}

function TargetBody({
  api,
  onProblem,
}: {
  readonly api: NonNullable<typeof window.llp>;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const target = useOrderEditorTarget(api);
  const labels = useOrderEditorLabels(api);
  if (target === null) return null;
  return (
    <OrderEditorTargetView
      key={`${target.serviceId}:${target.itemId}`}
      api={api}
      target={target}
      labels={labels}
      onProblem={onProblem}
    />
  );
}

/** The 순서 편집 window of one song item of a 예배 순서. */
export function OrderEditorWindow({
  closeFlush,
}: {
  readonly closeFlush?: CloseFlush | undefined;
}): JSX.Element {
  const [notices, setNotices] = useState<readonly Notice[]>([]);
  useShortcutSettings(window.llp);
  useUiZoomKeys();
  useEffect(() => watchInputModality(window), []);
  const report = useCallback(
    (notice: Notice) => setNotices(current => addNotice(current, notice)),
    [],
  );
  const api = window.llp;
  return (
    <div className={styles.window} data-workspace-layout="order-editor">
      <Titlebar />
      <main className={styles.body} aria-label={TITLE}>
        {api === undefined ? null : <TargetBody api={api} onProblem={report} />}
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
