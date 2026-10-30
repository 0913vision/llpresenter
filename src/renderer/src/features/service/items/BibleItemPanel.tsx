import {useMemo, type JSX} from 'react';
import type {ServiceItemOf} from '@core/schema/service';
import {VirtualSlides} from '@renderer/features/songs/editor/VirtualSlides';
import {defaultThumbnailColumns, type SizeClass} from '@renderer/ui/sizeClass';
import {useShow} from '@renderer/session/show';
import {
  saveThumbnailScale,
  showThumbnailScale,
  useThumbnailScale,
} from '@renderer/platform/thumbnailScale';
import {
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from '@renderer/ui/Panel';
import {ThumbnailSizeControl} from '@renderer/ui/ThumbnailSizeControl';
import {ITEM_PANEL_LABEL} from './OtherItemPanel';
import {shownPosition} from '../../songs/editor/songItemModel';
import {savedPassageTiles} from './bibleItemModel';
import styles from './OtherItemPanel.module.css';

/** Local selection over main's saved passage projection; no output handlers. */
export function BibleItemPanel({
  item,
  serviceId,
  position,
  onSelect,
  sizeClass,
}: {
  readonly item: ServiceItemOf<'bible'>;
  readonly serviceId: string;
  readonly position: number;
  readonly onSelect: (index: number) => void;
  readonly sizeClass: SizeClass;
}): JSX.Element {
  const tiles = useShow(view => savedPassageTiles(view, serviceId, item.id));
  const scale = useThumbnailScale(sizeClass);
  const projected = useMemo(
    () => ({
      slides: tiles.map(tile =>
        tile.label === null
          ? {lines: tile.lines}
          : {label: tile.label, lines: tile.lines},
      ),
    }),
    [tiles],
  );
  const numbers = useMemo(() => tiles.map((_, index) => index + 1), [tiles]);
  return (
    <Panel label={ITEM_PANEL_LABEL} className={styles.panel}>
      <PanelHeader>
        <PanelTitle
          title={item.bible.ref}
          meta={`슬라이드 ${tiles.length}개`}
        />
      </PanelHeader>
      <PanelBody variant="flush">
        <VirtualSlides
          song={projected}
          numbers={numbers}
          labels={[]}
          selected={shownPosition(position, tiles.length)}
          onSelect={onSelect}
          baseline={defaultThumbnailColumns[sizeClass]}
          scale={scale}
        />
      </PanelBody>
      <PanelFooter
        end={
          <ThumbnailSizeControl
            value={scale}
            onChange={value => showThumbnailScale(sizeClass, value)}
            onCommit={value => saveThumbnailScale(sizeClass, value)}
          />
        }
      />
    </Panel>
  );
}
