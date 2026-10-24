import type {JSX, ReactNode} from 'react';
import {classNames} from './classNames';
import {Icon, type IconSize} from './Icon';
import {titleTooltip, useTooltip} from './Tooltip';
import styles from './PreviewFrame.module.css';

const LARGE_ICON_SIZE: IconSize = 14;
const SMALL_ICON_SIZE: IconSize = 12;

/** Where a screen goes out: a monitor, or NDI (no icon, text only). */
export interface PreviewTarget {
  readonly kind: 'display' | 'ndi';
  /** Such as 모니터 2 or NDI. */
  readonly label: string;
}

/** Whether a screen's output is on, off, or in trouble. */
export type PreviewStatus =
  | {readonly kind: 'on'}
  | {readonly kind: 'off'}
  | {
      readonly kind: 'warning';
      /** What went wrong, such as 모니터 3 연결 끊김. */
      readonly reason: string;
      /** What the app does about it, such as 창으로 표시 중. */
      readonly detail?: string | undefined;
    };

/** One output screen in the preview panel. */
export interface PreviewScreen<Id extends string> {
  readonly id: Id;
  /** 본 화면, 무대 화면, or 방송 자막. */
  readonly name: string;
  readonly target: PreviewTarget;
  /** The Look name exactly as the user wrote it; the large preview shows it. */
  readonly look?: string | undefined;
  readonly status: PreviewStatus;
  /** Draws the frame in `chroma`, as the capture window of 방송 자막 does. */
  readonly chroma?: boolean | undefined;
}

export interface PreviewFrameProps<Id extends string> {
  /** The screens in their order; the small row keeps it without the large one. */
  readonly screens: ReadonlyArray<PreviewScreen<Id>>;
  /** The screen shown large. */
  readonly big: Id;
  /** The narrow window form: small previews as 64px rows. */
  readonly compact?: boolean | undefined;
  /** A click on a small preview makes that screen the large one. */
  readonly onBigChange: (id: Id) => void;
  /** Draws a screen's output, scaled to its frame. */
  readonly renderScreen: (screen: PreviewScreen<Id>) => ReactNode;
}

/** The tooltip of a screen in a state, or `undefined` while its output is on. */
export function previewReason<Id extends string>(
  screen: PreviewScreen<Id>,
): string | undefined {
  const {status} = screen;
  switch (status.kind) {
    case 'on':
      return undefined;
    case 'off':
      return `${screen.name} 출력이 꺼져 있습니다`;
    case 'warning':
      return status.detail === undefined
        ? status.reason
        : `${status.reason}, ${status.detail}`;
  }
}

/** The name of a small preview button, with the short reason of its state. */
export function smallPreviewName<Id extends string>(
  screen: PreviewScreen<Id>,
): string {
  const name = `${screen.name} 크게 보기`;
  const {status} = screen;
  switch (status.kind) {
    case 'on':
      return name;
    case 'off':
      return `${name}, 출력이 꺼져 있습니다`;
    case 'warning':
      return `${name}, ${status.reason}`;
  }
}

function stateOf(status: PreviewStatus): 'off' | 'warning' | undefined {
  return status.kind === 'on' ? undefined : status.kind;
}

function Frame<Id extends string>({
  screen,
  renderScreen,
}: {
  readonly screen: PreviewScreen<Id>;
  readonly renderScreen: (screen: PreviewScreen<Id>) => ReactNode;
}): JSX.Element {
  return (
    <span
      className={classNames(
        styles.frame,
        screen.chroma === true && styles.chroma,
      )}
    >
      <span className={styles.screen}>{renderScreen(screen)}</span>
    </span>
  );
}

function TargetIcon({
  target,
  warning,
  size,
}: {
  readonly target: PreviewTarget;
  readonly warning: boolean;
  readonly size: IconSize;
}): JSX.Element | null {
  if (warning) return <Icon name="warning" size={size} />;
  if (target.kind === 'ndi' || size === SMALL_ICON_SIZE) return null;
  return <Icon name="monitor" size={size} />;
}

function Caption<Id extends string>({
  screen,
  small,
}: {
  readonly screen: PreviewScreen<Id>;
  readonly small: boolean;
}): JSX.Element {
  const warning = screen.status.kind === 'warning';
  return (
    <span className={styles.caption}>
      <span className={styles.name}>{screen.name}</span>
      <span className={styles.target}>
        <TargetIcon
          target={screen.target}
          warning={warning}
          size={small ? SMALL_ICON_SIZE : LARGE_ICON_SIZE}
        />
        {screen.target.label}
      </span>
      {small || screen.look === undefined ? null : (
        <span className={styles.look}>{screen.look}</span>
      )}
    </span>
  );
}

type PreviewRole = 'large' | 'small';

interface ScreenCellProps<Id extends string> {
  readonly screen: PreviewScreen<Id>;
  readonly role: PreviewRole;
  readonly renderScreen: (screen: PreviewScreen<Id>) => ReactNode;
  readonly onBigChange: (id: Id) => void;
}

// NOTE(0913vision): A screen keeps one cell in the same place of the tree
// whichever size it has, and the grid moves the large one to the top. A swap
// changes only classes, the name row, and the button laid over a small cell,
// so the output drawn in the frame is never rebuilt and its video never
// restarts.
function ScreenCell<Id extends string>({
  screen,
  role,
  renderScreen,
  onBigChange,
}: ScreenCellProps<Id>): JSX.Element {
  const {targetProps, tooltip} = useTooltip(
    titleTooltip(previewReason(screen)),
  );
  const large = role === 'large';
  return (
    <div
      onPointerEnter={large ? targetProps.onPointerEnter : undefined}
      onPointerLeave={large ? targetProps.onPointerLeave : undefined}
      data-state={stateOf(screen.status)}
      className={large ? styles.main : styles.small}
    >
      <Frame screen={screen} renderScreen={renderScreen} />
      <Caption screen={screen} small={!large} />
      {large ? null : (
        <button
          {...targetProps}
          type="button"
          aria-label={smallPreviewName(screen)}
          className={styles.hit}
          onClick={() => onBigChange(screen.id)}
        />
      )}
      {tooltip}
    </div>
  );
}

/**
 * The body of the preview panel (`ll-monitor`): one screen large and the
 * others in a row of small previews, which a click swaps in. The output side
 * has no motion, so screens swap at once, and each screen's `renderScreen`
 * content stays mounted across swaps.
 */
export function PreviewFrame<Id extends string>({
  screens,
  big,
  compact = false,
  onBigChange,
  renderScreen,
}: PreviewFrameProps<Id>): JSX.Element {
  return (
    <div className={classNames(styles.monitor, compact && styles.compact)}>
      {screens.map(screen => (
        <ScreenCell
          key={screen.id}
          screen={screen}
          role={screen.id === big ? 'large' : 'small'}
          renderScreen={renderScreen}
          onBigChange={onBigChange}
        />
      ))}
    </div>
  );
}
