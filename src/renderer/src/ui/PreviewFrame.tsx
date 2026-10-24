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

function LargePreview<Id extends string>({
  screen,
  renderScreen,
}: {
  readonly screen: PreviewScreen<Id>;
  readonly renderScreen: (screen: PreviewScreen<Id>) => ReactNode;
}): JSX.Element {
  const {targetProps, tooltip} = useTooltip(
    titleTooltip(previewReason(screen)),
  );
  return (
    <div
      onPointerEnter={targetProps.onPointerEnter}
      onPointerLeave={targetProps.onPointerLeave}
      data-state={stateOf(screen.status)}
      className={styles.main}
    >
      <Frame screen={screen} renderScreen={renderScreen} />
      <Caption screen={screen} small={false} />
      {tooltip}
    </div>
  );
}

function SmallPreview<Id extends string>({
  screen,
  renderScreen,
  onBigChange,
}: {
  readonly screen: PreviewScreen<Id>;
  readonly renderScreen: (screen: PreviewScreen<Id>) => ReactNode;
  readonly onBigChange: (id: Id) => void;
}): JSX.Element {
  const {targetProps, tooltip} = useTooltip(
    titleTooltip(previewReason(screen)),
  );
  return (
    <>
      <button
        {...targetProps}
        type="button"
        aria-label={smallPreviewName(screen)}
        data-state={stateOf(screen.status)}
        className={styles.small}
        onClick={() => onBigChange(screen.id)}
      >
        <Frame screen={screen} renderScreen={renderScreen} />
        <Caption screen={screen} small />
      </button>
      {tooltip}
    </>
  );
}

/**
 * The body of the preview panel (`ll-monitor`): one screen large and the
 * others in a row of small previews, which a click swaps in. The output side
 * has no motion, so screens swap at once; the two screens that swap remount
 * their `renderScreen` content.
 */
export function PreviewFrame<Id extends string>({
  screens,
  big,
  compact = false,
  onBigChange,
  renderScreen,
}: PreviewFrameProps<Id>): JSX.Element {
  const large = screens.find(screen => screen.id === big);
  const smalls = screens.filter(screen => screen.id !== big);
  return (
    <div className={classNames(styles.monitor, compact && styles.compact)}>
      {large === undefined ? null : (
        <LargePreview screen={large} renderScreen={renderScreen} />
      )}
      {smalls.length === 0 ? null : (
        <div className={styles.smalls}>
          {smalls.map(screen => (
            <SmallPreview
              key={screen.id}
              screen={screen}
              renderScreen={renderScreen}
              onBigChange={onBigChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
