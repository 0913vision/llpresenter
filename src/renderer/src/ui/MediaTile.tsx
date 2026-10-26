import {
  memo,
  type CSSProperties,
  type JSX,
  type ReactElement,
  type ReactNode,
} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import type {MenuAnchor} from './Menu';
import {MissingFileMark, missingFileText} from './MissingFile';
import {Progress, progressPercent} from './StatusMarks';
import {
  gridMoves,
  stripMoves,
  TileList,
  type TileListPosition,
} from './TileList';
import {titleTooltip, useTooltip} from './Tooltip';
import styles from './MediaTile.module.css';

const LOOP_ICON_SIZE = 12;

/** The text of the tooltip of a tile that is still copying, such as 복사 중 62%. */
export function copyingText(percent: number): string {
  return `복사 중 ${Math.round(progressPercent(percent))}%`;
}

export interface MediaTileProps {
  /** The file name without its extension, such as 따뜻한 빛. */
  readonly name: string;
  /**
   * An image URL or a host-owned preview element, such as a paused video.
   * Keep element values stable with useMemo so this memoized tile can skip work.
   */
  readonly picture?: string | ReactElement | undefined;
  /** The length of a video as minutes:seconds, such as 0:30; none for an image. */
  readonly duration?: string | undefined;
  /** A video that plays in a loop; draws the loop icon before the duration. */
  readonly loop?: boolean | undefined;
  readonly selected?: boolean | undefined;
  /** The current background on the screens. */
  readonly live?: boolean | undefined;
  /** The path of the media file when it can't be found. */
  readonly missingFile?: string | undefined;
  /** How far copying into the media folder has come, 0 to 100, while it copies. */
  readonly copying?: number | undefined;
}

function tileState({
  live,
  missing,
  copying,
}: {
  readonly live: boolean;
  readonly missing: boolean;
  readonly copying: boolean;
}): string | undefined {
  const states = [
    live && 'live',
    missing && 'warning',
    copying && 'busy',
  ].filter(state => typeof state === 'string');
  return states.length === 0 ? undefined : states.join(' ');
}

function tooltipText(
  missingFile: string | undefined,
  copying: number | undefined,
): string | undefined {
  if (missingFile !== undefined) return missingFileText(missingFile);
  if (copying !== undefined) return copyingText(copying);
  return undefined;
}

function Duration({
  duration,
  loop,
}: {
  readonly duration: string;
  readonly loop: boolean;
}): JSX.Element {
  return (
    <span className={styles.duration}>
      {loop ? (
        <Icon name="loop" size={LOOP_ICON_SIZE} className={styles.loop} />
      ) : null}
      {duration}
    </span>
  );
}

function Copying({
  name,
  copying,
}: {
  readonly name: string;
  readonly copying: number;
}): JSX.Element {
  const percent = Math.round(progressPercent(copying));
  return (
    <span className={styles.busy}>
      {`${percent}%`}
      <Progress
        value={percent}
        label={`${name} 복사`}
        className={styles.progress}
      />
    </span>
  );
}

function Frame(props: MediaTileProps): JSX.Element {
  const {name, picture, duration, loop = false, missingFile, copying} = props;
  if (missingFile !== undefined) {
    return (
      <span className={styles.frame}>
        <MissingFileMark />
      </span>
    );
  }
  return (
    <span className={styles.frame}>
      {typeof picture === 'string' ? (
        <img className={styles.picture} src={picture} alt="" decoding="async" />
      ) : picture === undefined ? null : (
        <span className={styles.picture}>{picture}</span>
      )}
      {copying === undefined && duration !== undefined ? (
        <Duration duration={duration} loop={loop} />
      ) : null}
      {copying === undefined ? null : <Copying name={name} copying={copying} />}
    </span>
  );
}

/**
 * One background video or image in a `MediaGrid` or a `MediaStrip`: a 16:9
 * picture with its duration, and the name under it. A tile that is still
 * copying can't be used yet.
 */
export const MediaTile = memo((props: MediaTileProps): JSX.Element => {
  const {name, selected = false, live = false, missingFile, copying} = props;
  const {targetProps, tooltip} = useTooltip(
    titleTooltip(tooltipText(missingFile, copying)),
  );
  return (
    <button
      {...targetProps}
      type="button"
      role="option"
      aria-label={name}
      aria-selected={selected}
      aria-disabled={copying === undefined ? undefined : true}
      data-state={tileState({
        live,
        missing: missingFile !== undefined,
        copying: copying !== undefined,
      })}
      className={styles.tile}
    >
      <Frame {...props} />
      <span className={styles.name}>{name}</span>
      {tooltip}
    </button>
  );
});

/** The props that the media grid and the media strip share. */
export interface MediaListProps {
  /** The list name for assistive technology, such as 배경 영상. */
  readonly label: string;
  /** The index of the selected tile, which takes the Tab stop. */
  readonly selected: number | undefined;
  /** An arrow key moved the selection. */
  readonly onSelect: (index: number) => void;
  /**
   * A click or Enter on a tile: the media view selects it, and the media strip
   * of 진행 sends it out. On a tile whose file is missing, the caller opens
   * 다시 연결 instead.
   */
  readonly onActivate: (index: number) => void;
  /** A right-click, Shift F10, or the Menu key on a tile. */
  readonly onMenu?: ((index: number, anchor: MenuAnchor) => void) | undefined;
  readonly className?: string | undefined;
  /** The `MediaTile` items, in order. */
  readonly children: ReactNode;
}

export interface MediaGridProps
  extends MediaListProps, Pick<TileListPosition, 'positionOffset' | 'setSize'> {
  /** The column count, 2 to 8, from the panel's size slider. */
  readonly columns: number;
  /** A double click sends the media out. */
  readonly onOutput: (index: number) => void;
}

type GridStyle = CSSProperties & Readonly<Record<'--media-columns', number>>;

/** The playlist grid of the media view (`ll-media-grid`). */
export function MediaGrid(props: MediaGridProps): JSX.Element {
  const style: GridStyle = {'--media-columns': props.columns};
  return (
    <TileList
      label={props.label}
      moves={gridMoves}
      columns={props.columns}
      spaceKey="pass"
      arrowsMove="selection"
      selected={props.selected}
      onSelect={props.onSelect}
      onActivate={props.onActivate}
      onDoubleClick={props.onOutput}
      onMenu={props.onMenu}
      positionOffset={props.positionOffset}
      setSize={props.setSize}
      className={classNames(styles.grid, props.className)}
      style={style}
    >
      {props.children}
    </TileList>
  );
}

/**
 * A windowed host mounts part of a long strip and names the mounted tiles'
 * places in the full list with the position props.
 */
export type MediaStripProps = MediaListProps & TileListPosition;

/**
 * The media strip of 진행 (`ll-media-strip`): one row of 150px tiles that
 * scrolls sideways. A click doesn't take keyboard focus there, so → and Space
 * still go to 다음 슬라이드.
 */
export function MediaStrip(props: MediaStripProps): JSX.Element {
  return (
    <TileList
      workspace="show"
      label={props.label}
      moves={stripMoves}
      columns={1}
      spaceKey="pass"
      arrowsMove="selection"
      selected={props.selected}
      onSelect={props.onSelect}
      onActivate={props.onActivate}
      onMenu={props.onMenu}
      positionOffset={props.positionOffset}
      setSize={props.setSize}
      orientation={props.orientation}
      className={classNames(styles.strip, props.className)}
    >
      {props.children}
    </TileList>
  );
}
