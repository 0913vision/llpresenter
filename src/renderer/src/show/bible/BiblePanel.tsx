import type {JSX} from 'react';
import type {SizeClass} from '@renderer/shell/sizeClass';
import {useShow} from '@renderer/state/show';
import {isBibleSource} from '@renderer/state/showLibrary';
import {Button} from '@renderer/ui';
import {
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/Panel';
import {SlidePanelBody, SlideSizeControl} from '../SlidePanel';
import {showBiblePassage} from './actions';

export function BiblePanel({
  sizeClass,
}: {
  readonly sizeClass: SizeClass;
}): JSX.Element | null {
  const source = useShow(view =>
    isBibleSource(view, view.openItemId) ? view.bibleSource : null,
  );
  if (source === null) return null;
  return (
    <Panel label="성경">
      <PanelHeader>
        <PanelTitle
          title={source.passage.displayRef}
          meta={`슬라이드 ${source.tiles.length}개`}
        />
      </PanelHeader>
      <PanelBody variant="flush">
        <SlidePanelBody sizeClass={sizeClass} />
      </PanelBody>
      <PanelFooter
        end={
          <Button
            variant="primary"
            onClick={() => showBiblePassage(source.passage)}
          >
            바로 띄우기
          </Button>
        }
      >
        <SlideSizeControl sizeClass={sizeClass} />
      </PanelFooter>
    </Panel>
  );
}
