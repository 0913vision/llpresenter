import {memo, type CSSProperties, type JSX, type ReactNode} from 'react';
import {NO_LABEL_COLOR, type LabelColor} from '@shared/colors';
import {classNames} from './classNames';
import {labelInk} from './labelInk';
import {MissingFileMark, missingFileText} from './MissingFile';
import {
  gridMoves,
  rowMoves,
  TileList,
  type TileMoves,
  type TileSpaceKey,
  type TileListPosition,
} from './TileList';
import {titleTooltip, useTooltip} from './Tooltip';
import type {Workspace} from './workspace';
import styles from './SlideThumbnail.module.css';

const workspaceMoves: Readonly<Record<Workspace, TileMoves>> = {
  show: rowMoves,
  prep: gridMoves,
};

const workspaceSpaceKey: Readonly<Record<Workspace, TileSpaceKey>> = {
  show: 'pass',
  prep: 'press',
};

/** The props that both workspaces' 슬라이드 grids take. */
export interface ThumbnailGridBaseProps extends TileListPosition {
  /** The grid name for assistive technology, such as 슬라이드. */
  readonly label: string;
  /** Baseline columns for sizing; filled tracks when tileWidth is absent. */
  readonly columns: number;
  /** Fixed CSS-pixel tile width from thumbnailWidth; omitting it fills columns. */
  readonly tileWidth?: number | undefined;
  /**
   * The index of the selected thumbnail, which takes the Tab stop. While it is
   * `undefined`, the first thumbnail takes it.
   */
  readonly selected: number | undefined;
  /** An arrow key moved the selection; in 준비, also a click, Enter, or Space. */
  readonly onSelect: (index: number) => void;
  readonly className?: string | undefined;
  /** The `SlideThumbnail` items, in order; an index counts only these. */
  readonly children: ReactNode;
}

/** The 슬라이드 grid of 진행, where a click or Enter outputs a 슬라이드. */
export interface ShowThumbnailGridProps extends ThumbnailGridBaseProps {
  readonly workspace: 'show';
  /** A click or Enter outputs that 슬라이드. */
  readonly onOutput: (index: number) => void;
}

/** The 슬라이드 grid of 준비, where a click or Enter only selects. */
export interface PrepThumbnailGridProps extends ThumbnailGridBaseProps {
  readonly workspace: 'prep';
}

export type ThumbnailGridProps =
  ShowThumbnailGridProps | PrepThumbnailGridProps;

interface GridStyle extends CSSProperties {
  readonly '--thumb-columns': number;
  readonly '--thumb-width'?: string | undefined;
}

/**
 * The 슬라이드 grid (`ll-thumb-grid`): a listbox of `SlideThumbnail` items that Tab
 * enters once. The arrow keys move the selection; a click or Enter outputs a
 * 슬라이드 in 진행 and selects it in 준비. While focus is in the grid, it follows the
 * selection, also when 다음 슬라이드 moves it. 진행 keeps keyboard focus without
 * drawing its focus outline; 준비 draws it.
 */
export function ThumbnailGrid(props: ThumbnailGridProps): JSX.Element {
  const {workspace, columns, onSelect} = props;
  const fixedWidth =
    props.tileWidth !== undefined &&
    Number.isFinite(props.tileWidth) &&
    props.tileWidth > 0
      ? props.tileWidth
      : undefined;
  const style: GridStyle = {
    '--thumb-columns': columns,
    '--thumb-width': fixedWidth === undefined ? undefined : `${fixedWidth}px`,
  };
  return (
    <TileList
      workspace={workspace}
      label={props.label}
      positionOffset={props.positionOffset}
      setSize={props.setSize}
      orientation={props.orientation}
      moves={workspaceMoves[workspace]}
      columns={fixedWidth === undefined ? columns : 'auto'}
      spaceKey={workspaceSpaceKey[workspace]}
      takesClickFocus
      arrowsMove="selection"
      selected={props.selected}
      onSelect={onSelect}
      onActivate={props.workspace === 'show' ? props.onOutput : onSelect}
      className={classNames(
        styles.grid,
        fixedWidth !== undefined && styles.sized,
        props.className,
      )}
      style={style}
    >
      {props.children}
    </TileList>
  );
}

export interface SlideThumbnailProps {
  /** The 슬라이드 number in the band, from 1. */
  readonly number: number;
  /** The 이름표 name; leave it out for a 슬라이드 without an 이름표. */
  readonly label?: string | undefined;
  /** The 이름표 color; `none` paints the band `label-none`. */
  readonly labelColor?: LabelColor | undefined;
  /** The lyrics, with the line breaks as written in the 슬라이드. */
  readonly text?: string | undefined;
  /**
   * The URL of an image placed in the 슬라이드 itself, or of a video's poster frame.
   * Never the song's default background.
   */
  readonly media?: string | undefined;
  /** The path of the 슬라이드 media file when it can't be found. */
  readonly missingFile?: string | undefined;
  readonly selected?: boolean | undefined;
  readonly live?: boolean | undefined;
  /** Physical hot key code assigned to this slide, e.g. KeyA or Digit1. */
  readonly hotKey?: string | undefined;
}

/** Formats a physical key code into a compact label, e.g. KeyA to A, Digit1 to 1. */
export function formatSlideHotKey(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

/** The name assistive technology reads: number, 이름표, first line, optional hotkey. */
export function thumbnailName({
  number,
  label,
  text,
  hotKey,
}: Pick<SlideThumbnailProps, 'number' | 'label' | 'text' | 'hotKey'>): string {
  const head = label === undefined ? `${number}` : `${number} ${label}`;
  const firstLine = text?.split('\n')[0]?.trim() ?? '';
  const keyInfo =
    hotKey === undefined ? '' : `, 단축키 ${formatSlideHotKey(hotKey)}`;
  return firstLine === ''
    ? `${head}${keyInfo}`
    : `${head}, ${firstLine}${keyInfo}`;
}

function thumbnailState(live: boolean, missing: boolean): string | undefined {
  const states = [live && 'live', missing && 'warning'].filter(
    state => typeof state === 'string',
  );
  return states.length === 0 ? undefined : states.join(' ');
}

function Canvas({
  text,
  media,
  missingFile,
  hotKey,
}: Pick<
  SlideThumbnailProps,
  'text' | 'media' | 'missingFile' | 'hotKey'
>): JSX.Element {
  if (missingFile !== undefined) {
    return (
      <span className={styles.canvas}>
        <MissingFileMark />
        {hotKey !== undefined && (
          <span className={styles.hotKey} aria-hidden="true">
            {formatSlideHotKey(hotKey)}
          </span>
        )}
      </span>
    );
  }
  return (
    <span className={styles.canvas}>
      {media === undefined ? null : (
        <img className={styles.media} src={media} alt="" decoding="async" />
      )}
      {text === undefined ? null : <span className={styles.text}>{text}</span>}
      {hotKey !== undefined && (
        <span className={styles.hotKey} aria-hidden="true">
          {formatSlideHotKey(hotKey)}
        </span>
      )}
    </span>
  );
}

/**
 * One 슬라이드 in a `ThumbnailGrid`: a 16:9 output canvas and a 24px 이름표 band.
 * Rings show selected and live; live wins.
 */
export const SlideThumbnail = memo(
  ({
    number,
    label,
    labelColor = NO_LABEL_COLOR,
    text,
    media,
    missingFile,
    selected = false,
    live = false,
    hotKey,
  }: SlideThumbnailProps): JSX.Element => {
    const {targetProps, tooltip} = useTooltip(
      titleTooltip(
        missingFile === undefined ? undefined : missingFileText(missingFile),
      ),
    );
    return (
      <button
        {...targetProps}
        type="button"
        role="option"
        aria-selected={selected}
        aria-label={thumbnailName({number, label, text, hotKey})}
        data-state={thumbnailState(live, missingFile !== undefined)}
        data-color={labelColor === NO_LABEL_COLOR ? undefined : labelColor}
        className={styles.thumb}
      >
        <Canvas
          text={text}
          media={media}
          missingFile={missingFile}
          hotKey={hotKey}
        />
        <span className={styles.band} style={labelInk(labelColor)}>
          <span className={styles.number}>{number}</span>
          {label === undefined ? null : (
            <span className={styles.label}>{label}</span>
          )}
        </span>
        {tooltip}
      </button>
    );
  },
);
