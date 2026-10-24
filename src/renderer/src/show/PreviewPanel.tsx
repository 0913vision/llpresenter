import type {JSX} from 'react';
import {Icon} from '@renderer/ui/Icon';
import {useOutputs} from '@renderer/state/live';
import {showLarge, usePreview} from '@renderer/state/preview';
import {defaultScreens, type ScreenSummary} from '@renderer/shell/screens';
import {ScreenPreview, type FrameState} from './ScreenPreview';
import styles from './PreviewPanel.module.css';

function frameStateOf(on: boolean): FrameState {
  return on ? 'on' : 'off';
}

function offTooltip(screen: ScreenSummary): string {
  return `${screen.statusLabel} 출력이 꺼져 있습니다`;
}

function LargePreview({
  screen,
  on,
}: {
  readonly screen: ScreenSummary;
  readonly on: boolean;
}): JSX.Element {
  return (
    <div
      className={styles.large}
      data-screen={screen.id}
      data-state={on ? undefined : 'off'}
      title={on ? undefined : offTooltip(screen)}
    >
      <ScreenPreview chroma={screen.chroma} state={frameStateOf(on)} />
      <div className={styles.caption}>
        <span className={styles.name}>{screen.statusLabel}</span>
        <span className={styles.target}>
          <Icon name="laptop" size={14} />
          {screen.target}
        </span>
        <span className={styles.look}>{screen.lookName}</span>
      </div>
    </div>
  );
}

function SmallPreview({
  screen,
  on,
  compact,
}: {
  readonly screen: ScreenSummary;
  readonly on: boolean;
  readonly compact: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      className={compact ? `${styles.small} ${styles.compact}` : styles.small}
      data-screen={screen.id}
      data-state={on ? undefined : 'off'}
      title={on ? undefined : offTooltip(screen)}
      aria-label={`${screen.statusLabel} 미리보기 크게 보기`}
      onClick={() => showLarge(screen.id)}
    >
      <ScreenPreview chroma={screen.chroma} state={frameStateOf(on)} />
      <span className={styles.smallCaption}>
        <span className={styles.smallName}>{screen.statusLabel}</span>
        <span className={styles.smallTarget}>{screen.target}</span>
      </span>
    </button>
  );
}

/**
 * The preview panel of the 진행 workspace: one screen large and the other two
 * small. Every preview shows what its screen's output shows now, so a click on
 * a small one only changes which one is large.
 *
 * @param compact - The narrow window form: the small previews become rows.
 */
export function PreviewPanel({
  compact,
}: {
  readonly compact: boolean;
}): JSX.Element {
  const largeScreenId = usePreview(view => view.largeScreenId);
  const outputs = useOutputs();
  const large =
    defaultScreens.find(screen => screen.id === largeScreenId) ??
    defaultScreens[0];
  if (!large) return <div />;
  const smalls = defaultScreens.filter(screen => screen.id !== large.id);
  return (
    <div className={styles.panel}>
      <LargePreview screen={large} on={outputs[large.id] ?? false} />
      <div className={compact ? styles.smallRows : styles.smalls}>
        {smalls.map(screen => (
          <SmallPreview
            key={screen.id}
            screen={screen}
            on={outputs[screen.id] ?? false}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}
