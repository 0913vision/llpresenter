import {useLayoutEffect, useRef, type JSX} from 'react';
import type {Notice} from '@renderer/ui/notices';
import {Button} from '@renderer/ui/Button';
import {Icon} from '@renderer/ui/Icon';
import {AudioListsPanel, MediaListsPanel} from './MediaListPanels';
import {MediaPropertiesPanel} from './MediaPropertiesPanel';
import {MediaView} from './MediaView';
import {useMediaView} from './MediaViewProvider';
import {chosenPlaylist, mediaEntries, UNNAMED_PLAYLIST} from './mediaEntries';
import styles from './MediaBin.module.css';

/** The shared bottom media bin, without replacing the workspace's editor. */
export function MediaBin({
  workspace,
  onProblem,
  open = true,
  onOpenChange,
}: {
  readonly workspace: 'show' | 'prep';
  readonly onProblem: (notice: Notice) => void;
  readonly open?: boolean;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
}): JSX.Element {
  const root = useRef<HTMLElement>(null);
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
    <section ref={root} aria-label="미디어 보관함" className={styles.bin}>
      <div className={styles.lists}>
        <MediaListsPanel />
        <AudioListsPanel />
      </div>
      <MediaView
        workspace={workspace}
        onProblem={onProblem}
        onCollapse={
          onOpenChange === undefined
            ? undefined
            : button => change(false, button)
        }
      />
      <MediaPropertiesPanel />
    </section>
  );
}
