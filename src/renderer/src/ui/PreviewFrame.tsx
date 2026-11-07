import type {JSX, ReactNode} from 'react';
import {classNames} from './classNames';
import {Icon, type IconSize} from './Icon';
import {titleTooltip, useTooltip} from './Tooltip';
import {useButtonPress} from './press';
import styles from './PreviewFrame.module.css';

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
  /** 청중 화면, 무대 화면, or 방송 화면. */
  readonly name: string;
  /** Where it goes out; absent for a picture that goes nowhere, as in 준비. */
  readonly target?: PreviewTarget | undefined;
  readonly status: PreviewStatus;
  /** Draws the frame in `chroma`, as the capture window of 방송 화면 does. */
  readonly chroma?: boolean | undefined;
  /** A picture-specific state, separate from whether the screen output is on. */
  readonly indicator?:
    {readonly icon: string; readonly text: string} | undefined;
}

export interface PreviewFrameProps<Id extends string> {
  /** Every screen; the one in `big` is large and the others are small tiles. */
  readonly screens: ReadonlyArray<PreviewScreen<Id>>;
  /** The screen shown large. */
  readonly big: Id;
  /** The narrow window form keeps the same horizontal slot order. */
  readonly compact?: boolean | undefined;
  /** Content sizing preserves picture geometry inside a scrolling body. */
  readonly sizing?: 'fill' | 'content';
  /** Shows the row of small tiles. Without it, only the large picture shows. */
  readonly tiles?: boolean | undefined;
  /** Drawn over the bottom edge of the large picture, such as a progress bar. */
  readonly overlay?: ReactNode;
  /** What the large caption shows instead of the name and the target. */
  readonly caption?: ((screen: PreviewScreen<Id>) => ReactNode) | undefined;
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
      return `${screen.name} 출력 꺼짐`;
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
      return `${name}, 출력 꺼짐`;
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
  overlay,
}: {
  readonly screen: PreviewScreen<Id>;
  readonly large: boolean;
  readonly renderScreen: (screen: PreviewScreen<Id>) => ReactNode;
  readonly overlay?: ReactNode;
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
        {overlay === undefined || overlay === null ? null : (
          <div className={styles.overlay}>{overlay}</div>
        )}
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
  custom,
}: {
  readonly screen: PreviewScreen<Id>;
  readonly small: boolean;
  readonly custom?: ((screen: PreviewScreen<Id>) => ReactNode) | undefined;
}): JSX.Element {
  const warning = screen.status.kind === 'warning';
  if (!small && custom !== undefined) {
    return <div className={styles.caption}>{custom(screen)}</div>;
  }
  return (
    <div className={styles.caption}>
      <span className={styles.name}>{screen.name}</span>
      {screen.indicator === undefined ? null : (
        <PictureIndicator indicator={screen.indicator} />
      )}
      {small || screen.target === undefined ? null : (
        <span className={styles.target}>
          <TargetIcon
            target={screen.target}
            warning={warning}
            size={LARGE_ICON_SIZE}
          />
          {screen.target.label}
        </span>
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
  readonly caption?: ((screen: PreviewScreen<Id>) => ReactNode) | undefined;
  readonly overlay?: ReactNode;
  readonly onBigChange: (id: Id) => void;
}

// NOTE(0913vision): A screen's picture stays one element while it moves between
// the large place and a tile: only its grid place changes, so no renderer or
// playing video is reparented. A tile's button is a sibling over it.
function ScreenCell<Id extends string>({
  screen,
  role,
  column,
  renderScreen,
  caption,
  overlay,
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
        <Frame
          screen={screen}
          large={large}
          renderScreen={renderScreen}
          overlay={large ? overlay : undefined}
        />
        <Caption screen={screen} small={!large} custom={caption} />
      </div>
      {large ? null : (
        <button
          {...targetProps}
          {...press}
          type="button"
          aria-label={smallPreviewName(screen)}
          data-preview-slot={screen.id}
          data-state={stateOf(screen.status)}
          className={styles.hit}
          style={{gridColumn: column}}
        />
      )}
      {tooltip}
    </>
  );
}

/**
 * One large picture of the chosen screen, and a row of small tiles for the
 * other screens only. A click on a tile makes it the large one. Each screen's
 * single picture stays mounted across swaps.
 */
export function PreviewFrame<Id extends string>({
  screens,
  big,
  compact = false,
  sizing = 'fill',
  tiles = true,
  overlay,
  caption,
  onBigChange,
  renderScreen,
}: PreviewFrameProps<Id>): JSX.Element {
  const others = screens.filter(screen => screen.id !== big);
  return (
    <div
      className={classNames(
        styles.monitor,
        compact && styles.compact,
        sizing === 'content' && styles.content,
        !tiles && styles.single,
      )}
      style={{
        gridTemplateColumns: `repeat(${Math.max(1, tiles ? others.length : 1)}, minmax(var(--size-preview-compact), 1fr))`,
      }}
    >
      {screens.map(screen => {
        const isBig = screen.id === big;
        if (!isBig && !tiles) return null;
        return (
          <ScreenCell
            key={screen.id}
            screen={screen}
            role={isBig ? 'large' : 'small'}
            column={isBig ? 1 : others.indexOf(screen) + 1}
            renderScreen={renderScreen}
            caption={caption}
            overlay={overlay}
            onBigChange={onBigChange}
          />
        );
      })}
    </div>
  );
}
