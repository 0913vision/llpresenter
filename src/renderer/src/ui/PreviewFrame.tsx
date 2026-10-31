import type {JSX, ReactNode} from 'react';
import {classNames} from './classNames';
import {Icon, type IconSize} from './Icon';
import {titleTooltip, useTooltip} from './Tooltip';
import {useButtonPress} from './press';
import styles from './PreviewFrame.module.css';
import {TruncatedText} from './TruncatedText';

const LARGE_ICON_SIZE: IconSize = 14;

/** Where a screen goes out: a monitor, window, capture window, or NDI. */
export interface PreviewTarget {
  readonly kind: 'display' | 'window' | 'capture' | 'ndi';
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
  /** A picture-specific state, separate from whether the screen output is on. */
  readonly indicator?:
    {readonly icon: string; readonly text: string} | undefined;
}

export interface PreviewFrameProps<Id extends string> {
  /** The screens in their fixed slot order, including the selected screen. */
  readonly screens: ReadonlyArray<PreviewScreen<Id>>;
  /** The screen shown large. */
  readonly big: Id;
  /** The narrow window form keeps the same horizontal slot order. */
  readonly compact?: boolean | undefined;
  /** Content sizing preserves picture geometry inside a scrolling body. */
  readonly sizing?: 'fill' | 'content';
  /** Selects the large monitoring picture without changing output. */
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
  large,
  renderScreen,
}: {
  readonly screen: PreviewScreen<Id>;
  readonly large: boolean;
  readonly renderScreen: (screen: PreviewScreen<Id>) => ReactNode;
}): JSX.Element {
  return (
    <div className={styles.surface}>
      <div
        className={classNames(
          styles.frame,
          large && styles.fit,
          screen.chroma === true && styles.chroma,
        )}
      >
        <div className={styles.screen}>{renderScreen(screen)}</div>
      </div>
    </div>
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
  if (target.kind === 'ndi') return null;
  return (
    <Icon
      name={
        target.kind === 'display'
          ? 'monitor'
          : target.kind === 'capture'
            ? 'capture'
            : 'mplay'
      }
      size={size}
    />
  );
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
    <div className={styles.caption}>
      <span className={styles.name}>{screen.name}</span>
      {screen.indicator === undefined ? null : (
        <PictureIndicator indicator={screen.indicator} />
      )}
      {small ? null : (
        <span className={styles.target}>
          <TargetIcon
            target={screen.target}
            warning={warning}
            size={LARGE_ICON_SIZE}
          />
          {screen.target.label}
        </span>
      )}
      {small || screen.look === undefined ? null : (
        <span className={styles.look}>{screen.look}</span>
      )}
    </div>
  );
}

function PictureIndicator({
  indicator,
}: {
  readonly indicator: {readonly icon: string; readonly text: string};
}): JSX.Element {
  const {targetProps, tooltip} = useTooltip({text: indicator.text});
  return (
    <>
      <span
        {...targetProps}
        tabIndex={0}
        role="img"
        aria-label={indicator.text}
        className={styles.indicator}
      >
        <Icon name={indicator.icon} size={14} />
      </span>
      {tooltip}
    </>
  );
}

type PreviewRole = 'large' | 'small';

interface ScreenCellProps<Id extends string> {
  readonly screen: PreviewScreen<Id>;
  readonly role: PreviewRole;
  readonly column: number;
  readonly renderScreen: (screen: PreviewScreen<Id>) => ReactNode;
  readonly onBigChange: (id: Id) => void;
}

// NOTE(0913vision): Pictures and slot buttons are persistent siblings. Only
// grid positions change, so no renderer or playing video is reparented.
function ScreenCell<Id extends string>({
  screen,
  role,
  column,
  renderScreen,
  onBigChange,
}: ScreenCellProps<Id>): JSX.Element {
  const {targetProps, tooltip} = useTooltip(
    titleTooltip(previewReason(screen)),
  );
  const press = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: () => onBigChange(screen.id),
    onBlur: targetProps.onBlur,
  });
  const large = role === 'large';
  return (
    <>
      <div
        onPointerEnter={large ? targetProps.onPointerEnter : undefined}
        onPointerLeave={large ? targetProps.onPointerLeave : undefined}
        data-state={stateOf(screen.status)}
        data-screen={screen.id}
        data-role={role}
        className={large ? styles.main : styles.small}
        style={{gridColumn: large ? '1 / -1' : column}}
      >
        <Frame screen={screen} large={large} renderScreen={renderScreen} />
        <Caption screen={screen} small={!large} />
      </div>
      <button
        {...targetProps}
        {...press}
        type="button"
        aria-label={smallPreviewName(screen)}
        aria-pressed={large}
        data-preview-slot={screen.id}
        data-state={stateOf(screen.status)}
        className={classNames(styles.hit, large && styles.selected)}
        style={{gridColumn: column}}
      >
        {large ? (
          <>
            <span
              className={styles.marker}
              data-selected-marker={screen.id}
              aria-hidden="true"
            >
              <Icon name="arrow" size={18} className={styles.arrow} />
            </span>
            <span className={styles.selectedCaption} aria-hidden="true">
              <Icon name="check" size={12} />
              <TruncatedText
                text={screen.name}
                className={styles.selectedName}
              />
            </span>
          </>
        ) : null}
      </button>
      {tooltip}
    </>
  );
}

/**
 * One large monitoring picture above a fixed row of screen slots. The selected
 * slot shows a marker; each screen's single picture stays mounted across swaps.
 */
export function PreviewFrame<Id extends string>({
  screens,
  big,
  compact = false,
  sizing = 'fill',
  onBigChange,
  renderScreen,
}: PreviewFrameProps<Id>): JSX.Element {
  return (
    <div
      className={classNames(
        styles.monitor,
        compact && styles.compact,
        sizing === 'content' && styles.content,
      )}
      style={{
        gridTemplateColumns: `repeat(${Math.max(1, screens.length)}, minmax(var(--size-preview-compact), 1fr))`,
      }}
    >
      {screens.map((screen, index) => (
        <ScreenCell
          key={screen.id}
          screen={screen}
          role={screen.id === big ? 'large' : 'small'}
          column={index + 1}
          renderScreen={renderScreen}
          onBigChange={onBigChange}
        />
      ))}
    </div>
  );
}
