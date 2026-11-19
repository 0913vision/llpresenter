import type {JSX} from 'react';
import {useShownItemId} from '@renderer/session/shownItem';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {useShow} from '@renderer/session/show';
import {bibleSourceFor} from '@renderer/session/showLibrary';
import {shownTilesFor} from '@renderer/session/showLibrary';
import {
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
  PanelTools,
} from '@renderer/ui/Panel';
import {SlidePanelBody, SlideSizeControl} from './SlidePanel';
import {BibleAdjacentButtons} from '../bible/BibleAdjacentButtons';
import {BibleDisplayControls} from './BibleDisplayControls';
import styles from './BiblePanel.module.css';
import {BibleInsertButton} from '../service/items/BibleInsertButton';
import type {Notice} from '@renderer/ui/notices';

export function BiblePanel({
  sizeClass,
  onProblem,
}: {
  readonly sizeClass: SizeClass;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const shownItemId = useShownItemId();
  const source = useShow(view => bibleSourceFor(view, shownItemId));
  const count = useShow(view => shownTilesFor(view, shownItemId)?.length ?? 0);
  if (source === null) return null;
  return (
    <Panel label="성경" className={styles.panel}>
      <PanelHeader>
        <PanelTitle title={source.passage.displayRef} />
      </PanelHeader>
      <PanelTools>
        <BibleDisplayControls key={source.id} source={source} />
      </PanelTools>
      <PanelBody variant="flush" className={styles.body}>
        <SlidePanelBody sizeClass={sizeClass} />
      </PanelBody>
      <div className={styles.footer}>
        <PanelFooter
          count={count}
          end={<BibleAdjacentButtons key={source.id} source={source} />}
        >
          <SlideSizeControl sizeClass={sizeClass} />
          <BibleInsertButton source={source} onProblem={onProblem} />
        </PanelFooter>
      </div>
    </Panel>
  );
}
