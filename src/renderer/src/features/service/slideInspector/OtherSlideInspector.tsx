import {useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind} from '@core/schema/service';
import {biblePartEffect, setBiblePartEffect} from '@core/bible/partTransitions';
import type {SlideTransition} from '@core/schema/slideTransition';
import {TransitionPicker} from './TransitionRows';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
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
  applyAll,
}: {
  readonly applyAll?: ((transition: SlideTransition) => void) | undefined;
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
}): JSX.Element {
  const {item, service, position, busy, bibleSelection} = useSyncExternalStore(
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
  const part = index >= 0 ? projection?.partsByTile[index] : undefined;
  const transition =
    bible && part != null
      ? biblePartEffect(item.bibleTransitions, part.reference, part.part)
      : card?.transition;
  const selectedParts =
    (bible && position !== 0) || (bible && card === undefined)
      ? (bibleSelection.length > 0 ? bibleSelection : [index])
          .map(selectedIndex => projection?.partsByTile[selectedIndex])
          .filter(part => part != null)
      : [];
  const values =
    bible && selectedParts.length > 0
      ? selectedParts.map(
          selectedPart =>
            biblePartEffect(
              item.bibleTransitions,
              selectedPart.reference,
              selectedPart.part,
            ) ?? {kind: 'none' as const, sec: 0.5},
        )
      : [transition ?? {kind: 'none' as const, sec: 0.5}];
  const value = values[0] ?? {kind: 'none' as const, sec: 0.5};
  const mixed = values.some(
    entry => JSON.stringify(entry) !== JSON.stringify(value),
  );
  const changeTransition = (next: SlideTransition, all = false): void => {
    if (item === null || service === null) return;
    editorTask(
      items.submitItemEdit({
        target: {serviceId: service.service.id, itemId: item.id},
        failure: '\uc804\ud658 \uc800\uc7a5 \uc2e4\ud328',
        change: current => {
          let updated = current;
          if ((all || card !== undefined) && hasSectionCard(updated)) {
            updated = {
              ...updated,
              sectionCard: {...updated.sectionCard, transition: next},
            };
          }
          if (isItemOfKind(updated, 'bible')) {
            const parts = all
              ? (projection?.partsByTile ?? []).filter(part => part != null)
              : selectedParts;
            let transitions = updated.bibleTransitions ?? [];
            for (const entry of parts) {
              transitions = setBiblePartEffect(
                transitions,
                {verse: entry.reference, part: entry.part},
                next,
              );
            }
            return {...updated, bibleTransitions: transitions};
          }
          return updated;
        },
      }),
    );
  };
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
                  output
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
                  output
                  themeId={appearance.theme.themeId}
                  screen={appearance.screen}
                  slide={layer}
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
        {(card !== undefined || part != null) && service !== null ? (
          <TransitionPicker
            value={value}
            allowAll={bible || applyAll !== undefined}
            mixed={mixed}
            disabled={busy || service.access !== 'editable'}
            selectionKey={selectedParts
              .map(
                entry =>
                  `${entry.reference.book}:${entry.reference.chapter}:${entry.reference.verse}:${entry.part}`,
              )
              .join(',')}
            onChange={changeTransition}
            onSeconds={sec => changeTransition({...value, sec})}
            onApplyAll={() => {
              if (applyAll === undefined) changeTransition(value, true);
              else applyAll(value);
            }}
          />
        ) : null}
      </PanelBody>
    </Panel>
  );
}
