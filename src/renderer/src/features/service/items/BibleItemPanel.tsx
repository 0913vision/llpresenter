import {cardOffset} from '@core/services/sectionCards';
import {useMemo, type JSX, type ReactNode} from 'react';
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
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {slideLayerOf} from '@core/presentation/slideLayer';
import styles from './OtherItemPanel.module.css';

/** Local selection over main's saved passage projection; no output handlers. */
export function BibleItemPanel({
  item,
  serviceId,
  position,
  onSelect,
  sizeClass,
  children,
}: {
  readonly item: ServiceItemOf<'bible'>;
  readonly serviceId: string;
  readonly position: number;
  readonly onSelect: (index: number) => void;
  readonly sizeClass: SizeClass;
  readonly children?: ReactNode;
}): JSX.Element {
  const rawTiles = useShow(view => savedPassageTiles(view, serviceId, item.id));
  const projection = useBibleTileProjection({itemId: item.id, serviceId});
  const tiles = (projection?.tiles ?? rawTiles).filter(
    tile => tile.sectionCard === undefined,
  );
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
        <PanelTitle title={item.bible.ref} />
      </PanelHeader>
      <PanelBody variant="flush">
        {children ?? (
          <VirtualSlides
            song={projected}
            numbers={numbers}
            labels={[]}
            selected={shownPosition(position, tiles.length)}
            onSelect={onSelect}
            baseline={defaultThumbnailColumns[sizeClass]}
            scale={scale}
            canvasFor={index => {
              const appearance = projection?.appearance;
              const slide = slideLayerOf({itemId: item.id, index}, () => tiles);
              return appearance === undefined || slide === null ? undefined : (
                <SlidePicture
                  slide={slide}
                  layout={appearance.theme.layout}
                  emptyColor={appearance.theme.emptyColor}
                  item={appearance.theme.item}
                />
              );
            }}
          />
        )}
      </PanelBody>
      <PanelFooter
        count={tiles.length + cardOffset(item)}
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
