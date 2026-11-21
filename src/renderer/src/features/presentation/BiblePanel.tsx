import type {JSX} from 'react';
import {useShownItemId} from '@renderer/session/shownItem';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {useShow} from '@renderer/session/show';
import {bibleSourceFor} from '@renderer/session/showLibrary';
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  PanelTools,
} from '@renderer/ui/Panel';
import {GridFooter} from '@renderer/ui/GridFooter';
import {SlidePanelBody} from './SlidePanel';
import {SlideSizeControl} from '@renderer/platform/SlideSizeControl';
import {BibleAdjacentButtons} from '../bible/BibleAdjacentButtons';
import {BibleDisplayControls} from './BibleDisplayControls';
import styles from './BiblePanel.module.css';
import {BibleInsertButton} from '../service/items/BibleInsertButton';
import type {Notice} from '@renderer/ui/notices';

export function BiblePanel({
  sizeClass,
  onProblem,
  active = true,
}: {
  readonly sizeClass: SizeClass;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly active?: boolean;
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
        <SlidePanelBody sizeClass={sizeClass} active={active} />
      </PanelBody>
      <div className={styles.footer}>
        <GridFooter
          actions={<BibleAdjacentButtons key={source.id} source={source} />}
          zoom={<SlideSizeControl sizeClass={sizeClass} />}
        >
          <BibleInsertButton source={source} onProblem={onProblem} />
        </GridFooter>
      </div>
    </Panel>
  );
}
