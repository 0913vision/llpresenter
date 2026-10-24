import type {JSX} from 'react';
import {Icon} from '@renderer/ui/Icon';
import {useOutputs} from '@renderer/state/live';
import {showLarge, usePreview} from '@renderer/state/preview';
import {defaultScreens, type ScreenSummary} from '@renderer/shell/screens';
import {ScreenPreview, type FrameState} from './ScreenPreview';
import styles from './PreviewPanel.module.css';

type Role = 'large' | 'small';

function frameStateOf(on: boolean): FrameState {
  return on ? 'on' : 'off';
}

function offTooltip(screen: ScreenSummary): string {
  return `${screen.statusLabel} 출력이 꺼져 있습니다`;
}

function LargeCaption({screen}: {readonly screen: ScreenSummary}): JSX.Element {
  return (
    <div className={styles.caption}>
      <span className={styles.name}>{screen.statusLabel}</span>
      <span className={styles.target}>
        <Icon name="laptop" size={14} />
        {screen.target}
      </span>
      <span className={styles.look}>{screen.lookName}</span>
    </div>
  );
}

function SmallCaption({screen}: {readonly screen: ScreenSummary}): JSX.Element {
  return (
    <span className={styles.smallCaption}>
      <span className={styles.smallName}>{screen.statusLabel}</span>
      <span className={styles.smallTarget}>{screen.target}</span>
    </span>
  );
}

// NOTE(0913vision): A screen keeps one element in the same place of the tree
// whichever size it has, so a swap only changes classes and the caption. The
// output renderer inside it is never rebuilt, and its video never restarts. The
// button that makes a small preview large is a sibling laid over the frame.
function Preview({
  screen,
  role,
  on,
  compact,
}: {
  readonly screen: ScreenSummary;
  readonly role: Role;
  readonly on: boolean;
  readonly compact: boolean;
}): JSX.Element {
  const classes = [styles.item];
  if (role === 'large') classes.push(styles.large);
  if (role === 'small' && compact) classes.push(styles.compact);
  return (
    <div
      className={classes.join(' ')}
      data-screen={screen.id}
      data-role={role}
      data-state={on ? undefined : 'off'}
      title={on ? undefined : offTooltip(screen)}
    >
      <div className={styles.slot}>
        <ScreenPreview
          chroma={screen.chroma}
          state={frameStateOf(on)}
          fit={role === 'large'}
        />
      </div>
      {role === 'large' ? (
        <LargeCaption screen={screen} />
      ) : (
        <SmallCaption screen={screen} />
      )}
      {role === 'small' ? (
        <button
          type="button"
          className={styles.hit}
          aria-label={`${screen.statusLabel} 미리보기 크게 보기`}
          onClick={() => showLarge(screen.id)}
        />
      ) : null}
    </div>
  );
}

/**
 * The preview panel of the 진행 workspace: one screen large and the other two
 * small. Every preview shows what its screen's output shows now, so a click on
 * a small one only changes which one is large. The three previews stay in the
 * order 본 화면, 무대 화면, 방송 자막, and the grid puts the large one on top
 * and the small ones below it in that order.
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
  const large = defaultScreens.some(screen => screen.id === largeScreenId)
    ? largeScreenId
    : defaultScreens[0]?.id;
  return (
    <div className={compact ? `${styles.panel} ${styles.rows}` : styles.panel}>
      {defaultScreens.map(screen => (
        <Preview
          key={screen.id}
          screen={screen}
          role={screen.id === large ? 'large' : 'small'}
          on={outputs[screen.id] ?? false}
          compact={compact}
        />
      ))}
    </div>
  );
}
