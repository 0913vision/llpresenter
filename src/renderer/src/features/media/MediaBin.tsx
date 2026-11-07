import {useLayoutEffect, useRef, type JSX, type ReactNode} from 'react';
import {ResizeGap} from '@renderer/ui/ResizeGap';
import {useRowLayout, type RowSizeStore} from '@renderer/ui/useRowLayout';
import type {SizeClass} from '@renderer/ui/sizeClass';
import type {Notice} from '@renderer/ui/notices';
import {Button} from '@renderer/ui/Button';
import {Icon} from '@renderer/ui/Icon';
import {AudioListsPanel, MediaListsPanel} from './MediaListPanels';
import {MediaPropertiesPanel} from './MediaPropertiesPanel';
import {MediaView} from './MediaView';
import {useMediaView} from './MediaViewProvider';
import {chosenPlaylist, mediaEntries, UNNAMED_PLAYLIST} from './mediaEntries';
import styles from './MediaBin.module.css';
const noRowStore: RowSizeStore = {};

/** The shared bottom media bin, without replacing the workspace's editor. */
export function MediaBin({
  workspace,
  onProblem,
  open = true,
  onOpenChange,
  rowStore = noRowStore,
  sizeClass = 'normal',
  columnGap,
}: {
  readonly workspace: 'show' | 'prep';
  readonly onProblem: (notice: Notice) => void;
  readonly open?: boolean;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  readonly rowStore?: RowSizeStore | undefined;
  readonly sizeClass?: SizeClass | undefined;
  readonly columnGap?: ((column: 'left' | 'right') => ReactNode) | undefined;
}): JSX.Element {
  const root = useRef<HTMLElement>(null);
  const lists = useRef<HTMLDivElement>(null);
  const rows = useRowLayout({
    container: lists,
    store: rowStore,
    sizeClass,
    layoutKey: workspace,
    enabled: open,
    fill: 'first',
  });
  const restoreFocus = useRef(false);
  const {view, choice} = useMediaView();
  useLayoutEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    root.current?.querySelector<HTMLElement>('[data-media-toggle]')?.focus();
  }, [open]);
  const change = (next: boolean, button: HTMLButtonElement): void => {
    restoreFocus.current = document.activeElement === button;
    onOpenChange?.(next);
  };
  if (!open) {
    const playlist = chosenPlaylist(view.document, choice);
    const name =
      playlist === null ? '모든 미디어' : playlist.name || UNNAMED_PLAYLIST;
    const count = mediaEntries(view, choice).filter(
      entry => entry.kind === 'media',
    ).length;
    return (
      <section
        ref={root}
        aria-label="접힌 미디어 보관함"
        className={styles.collapsed}
      >
        <Button
          className={styles.bar}
          variant="ghost"
          aria-label="미디어 펼치기"
          aria-description={`${name}, ${count}개`}
          aria-expanded={false}
          data-media-toggle
          title="미디어 펼치기"
          disabled={onOpenChange === undefined}
          onClick={event => change(true, event.currentTarget)}
        >
          <Icon name="down" size={14} className={styles.expandIcon} />
          <span className={styles.label}>미디어</span>
          <span className={styles.summary}>
            {name} {count}
          </span>
        </Button>
      </section>
    );
  }
  return (
    <section
      ref={root}
      data-resize-panel="media.bin"
      data-resizable-columns={columnGap === undefined ? undefined : ''}
      aria-label="미디어 보관함"
      className={styles.bin}
    >
      <div ref={lists} className={styles.lists}>
        <div
          className={`${styles.playlist} ${styles.mediaLists}`}
          data-resize-panel="media.lists"
        >
          <MediaListsPanel />
        </div>
        <ResizeGap
          axis="row"
          name="media.lists"
          begin={() => rows.begin(0)}
          disabled={!rows.canResize(0)}
        />
        <div
          className={`${styles.playlist} ${styles.audioLists}`}
          data-resize-panel="media.audio"
        >
          <AudioListsPanel />
        </div>
      </div>
      {columnGap?.('left')}
      <MediaView
        workspace={workspace}
        onProblem={onProblem}
        onCollapse={
          onOpenChange === undefined
            ? undefined
            : button => change(false, button)
        }
      />
      {columnGap?.('right')}
      <MediaPropertiesPanel />
    </section>
  );
}
