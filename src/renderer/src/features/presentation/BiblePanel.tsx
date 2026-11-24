import type {JSX} from 'react';
import {useShownItemId} from '@renderer/session/show/shownItem';
import type {SizeClass} from '@renderer/ui/panels/sizeClass';
import {useShow} from '@renderer/session/show/show';
import {bibleSourceFor} from '@renderer/session/show/showLibrary';
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  PanelTools,
} from '@renderer/ui/panels/Panel';
import {GridFooter} from '@renderer/ui/lists/GridFooter';
import {SlidePanelBody} from './grid/SlidePanel';
import {SlideSizeControl} from '@renderer/platform/SlideSizeControl';
import {BibleAdjacentButtons} from '../bible/adjacent/BibleAdjacentButtons';
import {BibleDisplayControls} from './BibleDisplayControls';
import styles from './BiblePanel.module.css';
import {BibleInsertButton} from '../service/items/BibleInsertButton';
import type {Notice} from '@renderer/ui/popups/notices';

export function BiblePanel({
  sizeClass,
  onProblem,
}: {
  readonly sizeClass: SizeClass;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const shownItemId = useShownItemId();
  const source = useShow(view => bibleSourceFor(view, shownItemId));
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
        <GridFooter zoom={<SlideSizeControl sizeClass={sizeClass} />}>
          <BibleInsertButton source={source} onProblem={onProblem} />
          <BibleAdjacentButtons key={source.id} source={source} />
        </GridFooter>
      </div>
    </Panel>
  );
}
