import type {JSX} from 'react';
import type {Notice} from '@renderer/ui/notices';
import {AudioListsPanel, MediaListsPanel} from './MediaListPanels';
import {MediaPropertiesPanel} from './MediaPropertiesPanel';
import {MediaView} from './MediaView';
import styles from './MediaBin.module.css';

/** The shared bottom media bin, without replacing the workspace's editor. */
export function MediaBin({
  workspace,
  onProblem,
}: {
  readonly workspace: 'show' | 'prep';
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  return (
    <section aria-label="미디어 보관함" className={styles.bin}>
      <div className={styles.lists}>
        <MediaListsPanel />
        <AudioListsPanel />
      </div>
      <MediaView workspace={workspace} onProblem={onProblem} />
      <MediaPropertiesPanel />
    </section>
  );
}
