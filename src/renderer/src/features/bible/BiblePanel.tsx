import type {JSX} from 'react';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {useShow} from '@renderer/state/show';
import {bibleSourceFor} from '@renderer/state/showLibrary';
import {Button} from '@renderer/ui';
import {
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
  PanelTools,
} from '@renderer/ui/Panel';
import {SlidePanelBody, SlideSizeControl} from '../../show/SlidePanel';
import {showBiblePassage} from './actions';
import {BibleAdjacentButtons} from './BibleAdjacentButtons';
import {BibleDisplayControls} from './BibleDisplayControls';
import styles from './BiblePanel.module.css';
import {BibleInsertButton} from './BibleInsertButton';
import type {Notice} from '@renderer/ui/notices';

export function BiblePanel({
  sizeClass,
  onProblem,
}: {
  readonly sizeClass: SizeClass;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const source = useShow(view => bibleSourceFor(view, view.openItemId));
  if (source === null) return null;
  return (
    <Panel label="성경" className={styles.panel}>
      <PanelHeader>
        <PanelTitle
          title={source.passage.displayRef}
          meta={`슬라이드 ${source.tiles.length}개`}
        />
      </PanelHeader>
      <PanelTools>
        <BibleDisplayControls key={source.id} source={source} />
      </PanelTools>
      <PanelBody variant="flush" className={styles.body}>
        <SlidePanelBody sizeClass={sizeClass} />
      </PanelBody>
      <div className={styles.footer}>
        <PanelFooter
          end={
            <>
              <BibleAdjacentButtons key={source.id} source={source} />
              <Button
                variant="primary"
                onClick={() => showBiblePassage(source.passage)}
              >
                바로 띄우기
              </Button>
            </>
          }
        >
          <SlideSizeControl sizeClass={sizeClass} />
          <BibleInsertButton source={source} onProblem={onProblem} />
        </PanelFooter>
      </div>
    </Panel>
  );
}
