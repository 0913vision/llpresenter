import {useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind} from '@core/schema/service';
import {cardOffset, hasSectionCard} from '@core/services/sectionCards';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {useShow} from '@renderer/session/show';
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {MediaProperties} from '@renderer/features/media/MediaPropertiesPanel';
import {Panel, PanelBody} from '@renderer/ui/Panel';
import {labelInk} from '@renderer/ui/labelInk';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {useItemMedia} from '../items/useItemSources';
import {savedPassageTiles} from '../items/bibleItemModel';
import type {ServiceItemStore} from '../items/serviceItemStore';
import styles from './SlideInspector.module.css';

/** The local selected Bible or media item, never the output. */
export function OtherSlideInspector({
  items,
  editor,
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
}): JSX.Element {
  const {item, service, position} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const bible = item !== null && isItemOfKind(item, 'bible');
  const media = useItemMedia(
    editor.api.media,
    item !== null && isItemOfKind(item, 'media'),
  );
  const raw = useShow(view =>
    savedPassageTiles(view, service?.service.id, bible ? item.id : undefined),
  );
  const projection = useBibleTileProjection({
    itemId: bible ? item.id : null,
    ...(service === null ? {} : {serviceId: service.service.id}),
  });
  const tiles = (projection?.tiles ?? raw).filter(
    tile => tile.sectionCard === undefined,
  );
  const index = bible ? position - cardOffset(item) : -1;
  const card =
    item !== null && hasSectionCard(item) && position === 0
      ? item.sectionCard
      : undefined;
  const count =
    item !== null && isItemOfKind(item, 'slides')
      ? item.slides.slides.length + 1
      : tiles.length + 1;
  const cardTheme = useSlideTheme(
    card === undefined || item === null
      ? undefined
      : {
          id: item.id,
          kind: 'slides',
          form: 'blank',
          title: card.name,
          theme: card.theme,
        },
  );
  const tile = index >= 0 ? tiles[index] : undefined;
  const layer =
    bible && tile !== undefined
      ? slideLayerOf({itemId: item.id, index}, () => tiles)
      : null;
  const file =
    item !== null && isItemOfKind(item, 'media')
      ? media.document?.value.items.find(entry => entry.id === item.media)
      : undefined;
  const appearance = projection?.appearance;
  return (
    <Panel label="슬라이드 속성">
      <PanelBody>
        {file === undefined || file.kind === 'audio' ? null : (
          <>
            <div className={styles.picture} data-background-picture>
              <img
                className={styles.mediaPicture}
                src={
                  file.kind === 'video'
                    ? thumbnailSrc(file.id)
                    : mediaUrl(file.id)
                }
                alt=""
                onError={event => {
                  event.currentTarget.style.visibility = 'hidden';
                }}
                onLoad={event => {
                  event.currentTarget.style.visibility = '';
                }}
              />
            </div>
            <MediaProperties
              item={file}
              disabled={media.document?.access !== 'editable'}
            />
          </>
        )}
        {card === undefined ||
        cardTheme === undefined ||
        item === null ? null : (
          <>
            <div className={styles.picture} data-background-picture>
              <div className={styles.canvas}>
                <SlidePicture
                  exact
                  {...cardTheme}
                  slide={{
                    itemId: item.id,
                    position: 0,
                    label: card.name,
                    lines: [card.english],
                    sectionCard: card,
                  }}
                />
              </div>
            </div>
            <div className={styles.caption} style={labelInk('none')}>
              {card.name}
              <span>1 / {count}</span>
            </div>
          </>
        )}
        {tile === undefined ||
        layer === null ||
        appearance === undefined ? null : (
          <>
            <div className={styles.picture} data-background-picture>
              <div className={styles.canvas}>
                <SlidePicture
                  exact
                  slide={layer}
                  screen={appearance.screen}
                  themeId={appearance.theme.themeId}
                  layout={appearance.theme.layout}
                  emptyColor={appearance.theme.emptyColor}
                  item={appearance.theme.item}
                />
              </div>
            </div>
            <div className={styles.caption} style={labelInk(tile.labelColor)}>
              {tile.label ?? ''}
              <span>
                {index + 1} / {tiles.length}
              </span>
            </div>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
