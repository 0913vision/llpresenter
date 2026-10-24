import {
  memo,
  useEffect,
  useRef,
  type CSSProperties,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {NO_LABEL_COLOR, type LabelColor} from '@shared/colors';
import {classNames} from './classNames';
import {clickFocusProps} from './clickFocus';
import {Icon} from './Icon';
import {labelInk} from './labelInk';
import {titleTooltip, useTooltip} from './Tooltip';
import hatching from './hatching.module.css';
import type {Workspace} from './workspace';
import styles from './SlideThumbnail.module.css';

const MISSING_ICON_SIZE = 24;
const THUMBNAIL = '[role="option"]';
const SPACE = ' ';

type GridMoves = Readonly<Record<string, (columns: number) => number>>;

const rowMoves: GridMoves = {
  ArrowUp: columns => -columns,
  ArrowDown: columns => columns,
};

const workspaceMoves: Readonly<Record<Workspace, GridMoves>> = {
  show: rowMoves,
  prep: {...rowMoves, ArrowLeft: () => -1, ArrowRight: () => 1},
};

function hasModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

function thumbnailsOf(grid: HTMLElement): HTMLElement[] {
  return [...grid.querySelectorAll<HTMLElement>(THUMBNAIL)];
}

function indexOfTarget(grid: HTMLElement, target: EventTarget): number {
  const thumbnail =
    target instanceof Element ? target.closest(THUMBNAIL) : null;
  return thumbnailsOf(grid).findIndex(element => element === thumbnail);
}

/** The props that both workspaces' 장 grids take. */
export interface ThumbnailGridBaseProps {
  /** The grid name for assistive technology, such as 장. */
  readonly label: string;
  /** The column count, 2 to 8, from the panel's size slider. */
  readonly columns: number;
  /**
   * The index of the selected thumbnail, which takes the Tab stop. While it is
   * `undefined`, the grid takes the Tab stop and passes focus to the first one.
   */
  readonly selected: number | undefined;
  /** An arrow key moved the selection; in 준비, also a click, Enter, or Space. */
  readonly onSelect: (index: number) => void;
  readonly className?: string | undefined;
  /** The `SlideThumbnail` items, in order; an index counts only these. */
  readonly children: ReactNode;
}

/** The 장 grid of 진행, where a click or Enter outputs a 장. */
export interface ShowThumbnailGridProps extends ThumbnailGridBaseProps {
  readonly workspace: 'show';
  /** A click or Enter outputs that 장. */
  readonly onOutput: (index: number) => void;
}

/** The 장 grid of 준비, where a click or Enter only selects. */
export interface PrepThumbnailGridProps extends ThumbnailGridBaseProps {
  readonly workspace: 'prep';
}

export type ThumbnailGridProps =
  ShowThumbnailGridProps | PrepThumbnailGridProps;

type GridStyle = CSSProperties & Readonly<Record<'--thumb-columns', number>>;

function useFocusFollowsSelection(selected: number | undefined) {
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (selected === undefined || !grid?.contains(document.activeElement)) {
      return;
    }
    const thumbnail = thumbnailsOf(grid)[selected];
    if (thumbnail !== document.activeElement) thumbnail?.focus();
  }, [selected]);
  return gridRef;
}

/**
 * The 장 grid (`ll-thumb-grid`): a listbox of `SlideThumbnail` items that Tab
 * enters once. The arrow keys move the selection; a click or Enter outputs a
 * 장 in 진행 and selects it in 준비. While focus is in the grid, it follows the
 * selection, also when 다음 장 moves it.
 */
export function ThumbnailGrid(props: ThumbnailGridProps): JSX.Element {
  const {label, columns, selected, onSelect, className, children} = props;
  const moves = workspaceMoves[props.workspace];
  const gridRef = useFocusFollowsSelection(selected);

  const activate = (index: number): void => {
    if (props.workspace === 'show') {
      props.onOutput(index);
    } else {
      onSelect(index);
    }
  };
  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    const index = indexOfTarget(event.currentTarget, event.target);
    if (index >= 0) activate(index);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const move = moves[event.key];
    if (move === undefined || hasModifier(event)) return;
    event.preventDefault();
    const grid = event.currentTarget;
    const current = indexOfTarget(grid, event.target);
    const target = current + move(columns);
    if (current < 0 || target < 0 || target >= thumbnailsOf(grid).length) {
      return;
    }
    onSelect(target);
  };
  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>): void => {
    // NOTE(0913vision): A button clicks on the Space key's keyup. In 진행 that
    // Space belongs to 다음 장, so only the click is cancelled; the keydown
    // still reaches the window handler.
    if (props.workspace === 'show' && event.key === SPACE) {
      event.preventDefault();
    }
  };
  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      thumbnailsOf(event.currentTarget)[0]?.focus();
    }
  };
  const style: GridStyle = {'--thumb-columns': columns};

  return (
    <div
      {...clickFocusProps}
      ref={gridRef}
      role="listbox"
      aria-label={label}
      tabIndex={selected === undefined ? 0 : -1}
      className={classNames(styles.grid, className)}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onFocus={onFocus}
    >
      {children}
    </div>
  );
}

export interface SlideThumbnailProps {
  /** The 장 number in the band, from 1. */
  readonly number: number;
  /** The 이름표 name; leave it out for a 장 without an 이름표. */
  readonly label?: string | undefined;
  /** The 이름표 color; `none` paints the band `label-none`. */
  readonly labelColor?: LabelColor | undefined;
  /** The lyrics, with the line breaks as written in the 장. */
  readonly text?: string | undefined;
  /**
   * The URL of an image placed in the 장 itself, or of a video's poster frame.
   * Never the song's default background.
   */
  readonly media?: string | undefined;
  /** The path of the 장 media file when it can't be found. */
  readonly missingFile?: string | undefined;
  readonly selected?: boolean | undefined;
  readonly live?: boolean | undefined;
}

/** The name assistive technology reads: number, 이름표, first line. */
export function thumbnailName({
  number,
  label,
  text,
}: Pick<SlideThumbnailProps, 'number' | 'label' | 'text'>): string {
  const head = label === undefined ? `${number}` : `${number} ${label}`;
  const firstLine = text?.split('\n')[0]?.trim() ?? '';
  return firstLine === '' ? head : `${head}, ${firstLine}`;
}

/** The text of the missing file tooltip. */
export function missingFileText(path: string): string {
  return `파일을 찾을 수 없습니다: ${path}`;
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
}: Pick<SlideThumbnailProps, 'text' | 'media' | 'missingFile'>): JSX.Element {
  if (missingFile !== undefined) {
    return (
      <span className={styles.canvas}>
        <span className={classNames(styles.missing, hatching.hatching)}>
          <Icon name="filex" size={MISSING_ICON_SIZE} />
        </span>
      </span>
    );
  }
  return (
    <span className={styles.canvas}>
      {media === undefined ? null : (
        <img className={styles.media} src={media} alt="" decoding="async" />
      )}
      {text === undefined ? null : <span className={styles.text}>{text}</span>}
    </span>
  );
}

/**
 * One 장 in a `ThumbnailGrid`: a 16:9 output canvas and a 24px 이름표 band.
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
        aria-label={thumbnailName({number, label, text})}
        tabIndex={selected ? 0 : -1}
        data-state={thumbnailState(live, missingFile !== undefined)}
        data-color={labelColor === NO_LABEL_COLOR ? undefined : labelColor}
        className={styles.thumb}
      >
        <Canvas text={text} media={media} missingFile={missingFile} />
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
