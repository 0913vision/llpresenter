import {
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type JSX,
} from 'react';
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
import {sermonPreviewRow} from '@renderer/platform/sermonPreview';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {AtomicPictureContent} from '@renderer/rendering/AtomicPictureContent';
import {PictureReadiness} from '@renderer/rendering/PictureReadiness';
import type {MediaItem} from '@core/schema/mediaList';
import {MediaProperties} from '@renderer/features/media/MediaPropertiesPanel';
import {Panel, PanelBody} from '@renderer/ui/Panel';
import {Properties} from '@renderer/ui/PropertyRow';
import {labelInk} from '@renderer/ui/labelInk';
import {LITURGY} from '@core/services/liturgy';
import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {useItemMedia} from '../items/useItemSources';
import {savedPassageTiles} from '../items/bibleItemModel';
import type {ServiceItemStore} from '../items/serviceItemStore';
import styles from './SlideInspector.module.css';

function InspectorMediaPicture({
  file,
}: {
  readonly file: MediaItem;
}): JSX.Element {
  const ready = useContext(PictureReadiness);
  const source = useRef({});
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return (
    <img
      className={styles.mediaPicture}
      src={file.kind === 'video' ? thumbnailSrc(file.id) : mediaUrl(file.id)}
      alt=""
      onError={event => {
        event.currentTarget.style.visibility = 'hidden';
        ready?.(source.current);
      }}
      onLoad={event => {
        const image = event.currentTarget;
        image.style.visibility = '';
        if (ready === null) return;
        const finish = (): void => {
          if (alive.current) ready(source.current);
        };
        if (typeof image.decode === 'function') {
          image.decode().then(finish, finish);
        } else finish();
      }}
    />
  );
}

/** The local selected Bible or media item, never the output. */
export function OtherSlideInspector({
  items,
  editor,
  applyAll,
  changeSelected,
  cardTransition,
}: {
  readonly changeSelected?:
    ((change: SlideTransition | number) => void) | undefined;
  readonly cardTransition?: SlideTransition | null | undefined;
  readonly applyAll?: ((transition: SlideTransition) => void) | undefined;
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
}): JSX.Element {
  const {item, service, position, busy, bibleSelection, cardSelected} =
    useSyncExternalStore(items.subscribe, items.getSnapshot);
  const bible =
    item !== null &&
    (isItemOfKind(item, 'bible') || isItemOfKind(item, 'sermon'));
  const passage =
    item !== null && isItemOfKind(item, 'sermon')
      ? item.sermon.passage
      : item !== null && isItemOfKind(item, 'bible')
        ? item.bible
        : undefined;
  const liturgy = item !== null && isItemOfKind(item, 'liturgy') ? item : null;
  const liturgyIndex = liturgy === null ? -1 : position - cardOffset(liturgy);
  const liturgyTiles = useShow(view =>
    liturgy === null ? undefined : view.tiles[liturgy.id],
  );
  const liturgyLayer =
    liturgy === null || liturgyTiles === undefined
      ? null
      : slideLayerOf({itemId: liturgy.id, index: position}, () => liturgyTiles);
  const liturgyTheme = useSlideTheme(
    liturgy === null
      ? undefined
      : {
          kind: 'slides',
          form: 'blank',
          id: liturgy.id,
          title: LITURGY[liturgy.liturgy.kind].name,
          theme: liturgy.theme ?? CREED_PRAYER_THEME_ID,
        },
  );
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
    liturgy !== null
      ? (liturgyTiles?.length ?? 0)
      : item !== null && isItemOfKind(item, 'slides')
        ? item.slides.slides.length + 1
        : tiles.length + (item !== null && hasSectionCard(item) ? 1 : 0);
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
  const sermonTheme = useSlideTheme(
    item !== null && isItemOfKind(item, 'sermon')
      ? sermonPreviewRow(item.id, item.sermon.passage.ref)
      : undefined,
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
  const selectedParts =
    bible && (bibleSelection.length > 0 || card === undefined)
      ? (bibleSelection.length > 0 ? bibleSelection : [index])
          .map(selectedIndex => projection?.partsByTile[selectedIndex])
          .filter(part => part != null)
      : [];
  const selectedIndices = bibleSelection.length > 0 ? bibleSelection : [index];
  const selectedTitles =
    item !== null && isItemOfKind(item, 'sermon')
      ? selectedIndices.filter(i => tiles[i]?.sermonTitle === true)
      : [];
  const selectedCard =
    bible && cardSelected && hasSectionCard(item) ? item.sectionCard : card;
  const values = [
    ...(selectedCard === undefined
      ? []
      : [
          (cardTransition === undefined
            ? selectedCard.transition
            : cardTransition) ?? {kind: 'none' as const, sec: 0.5},
        ]),
    ...selectedTitles.map(
      i => tiles[i]?.transition ?? {kind: 'none' as const, sec: 0.5},
    ),
    ...(bible
      ? selectedParts.map(
          selectedPart =>
            biblePartEffect(
              item.bibleTransitions,
              selectedPart.reference,
              selectedPart.part,
            ) ??
            passage?.transition ?? {kind: 'none' as const, sec: 0.5},
        )
      : []),
    ...(liturgy !== null && liturgyIndex >= 0
      ? [
          liturgy.liturgy.transitions?.find(
            entry => entry.index === liturgyIndex,
          )?.transition ?? {kind: 'none' as const, sec: 0.5},
        ]
      : []),
  ];
  const value = values[0] ?? {kind: 'none' as const, sec: 0.5};
  const mixed = values.some(
    entry => JSON.stringify(entry) !== JSON.stringify(value),
  );
  const changeTransition = (
    next: SlideTransition | number,
    all = false,
  ): void => {
    if (item === null || service === null) return;
    if (!all && changeSelected !== undefined) {
      changeSelected(next);
      return;
    }
    editorTask(
      items.submitItemEdit({
        target: {serviceId: service.service.id, itemId: item.id},
        failure: '\uc804\ud658 \uc800\uc7a5 \uc2e4\ud328',
        change: current => {
          let updated = current;
          if ((all || selectedCard !== undefined) && hasSectionCard(updated)) {
            const old = updated.sectionCard.transition;
            const effect =
              typeof next === 'number'
                ? old === undefined
                  ? undefined
                  : {...old, sec: next}
                : next;
            if (effect !== undefined) {
              updated = {
                ...updated,
                sectionCard: {...updated.sectionCard, transition: effect},
              };
            }
          }
          if (
            isItemOfKind(updated, 'bible') ||
            isItemOfKind(updated, 'sermon')
          ) {
            const settings = isItemOfKind(updated, 'sermon')
              ? updated.sermon.passage
              : updated.bible;
            const parts = all
              ? (projection?.partsByTile ?? []).filter(part => part != null)
              : selectedParts;
            let transitions = updated.bibleTransitions ?? [];
            for (const entry of parts) {
              const old =
                biblePartEffect(transitions, entry.reference, entry.part) ??
                settings.transition;
              const effect =
                typeof next === 'number'
                  ? old === undefined
                    ? undefined
                    : {...old, sec: next}
                  : next;
              if (effect !== undefined) {
                transitions = setBiblePartEffect(
                  transitions,
                  {verse: entry.reference, part: entry.part},
                  effect,
                );
              }
            }
            if (isItemOfKind(updated, 'sermon')) {
              const indices = all ? [0, tiles.length - 1] : selectedTitles;
              let sermon = updated.sermon;
              for (const titleIndex of indices) {
                const key =
                  titleIndex === 0 ? 'openingTransition' : 'closingTransition';
                const old = sermon[key];
                const effect =
                  typeof next === 'number'
                    ? {...(old ?? {kind: 'none' as const, sec: 0.5}), sec: next}
                    : next;
                sermon = {...sermon, [key]: effect};
              }
              updated = {...updated, sermon};
            }
            const {bibleTransitions: _old, ...rest} = updated;
            return {
              ...rest,
              ...(transitions.length === 0
                ? {}
                : {bibleTransitions: transitions}),
            };
          }
          if (isItemOfKind(updated, 'liturgy') && (liturgyIndex >= 0 || all)) {
            const indices = all
              ? (liturgyTiles ?? [])
                  .slice(cardOffset(updated))
                  .map((_, index) => index)
              : [liturgyIndex];
            let transitions = [...(updated.liturgy.transitions ?? [])];
            for (const index of indices) {
              const old = transitions.find(
                entry => entry.index === index,
              )?.transition;
              const effect =
                typeof next === 'number'
                  ? {...(old ?? {kind: 'none' as const, sec: 0.5}), sec: next}
                  : next;
              transitions = [
                ...transitions.filter(entry => entry.index !== index),
                {index, transition: effect},
              ];
            }
            return {...updated, liturgy: {...updated.liturgy, transitions}};
          }
          return updated;
        },
      }),
    );
  };
  const hasFile = file !== undefined && file.kind !== 'audio';
  const hasCard =
    card !== undefined && cardTheme !== undefined && item !== null;
  const hasLiturgy =
    card === undefined &&
    liturgy !== null &&
    liturgyLayer !== null &&
    liturgyTheme !== undefined;
  const hasBible =
    tile !== undefined && layer !== null && appearance !== undefined;
  const pictureCount = [hasFile, hasCard, hasLiturgy, hasBible].filter(
    Boolean,
  ).length;
  return (
    <Panel label="슬라이드 속성">
      <PanelBody>
        <AtomicPictureContent
          identity={`${item?.id ?? 'none'}:${position}:${bibleSelection.join(',')}:${cardSelected}`}
          pending={
            (item !== null &&
              isItemOfKind(item, 'media') &&
              media.document === null &&
              !media.failed) ||
            (card !== undefined && cardTheme === undefined) ||
            (card === undefined &&
              liturgy !== null &&
              (liturgyLayer === null || liturgyTheme === undefined)) ||
            (tile !== undefined && (layer === null || appearance === undefined))
          }
          waitForPicture={pictureCount > 0}
          pictureCount={pictureCount}
          content={
            <div>
              {file === undefined || file.kind === 'audio' ? null : (
                <>
                  <div className={styles.picture} data-background-picture>
                    <InspectorMediaPicture file={file} />
                  </div>
                  <div
                    onKeyDownCapture={event => {
                      if (
                        event.key !== 'Enter' ||
                        event.nativeEvent.isComposing ||
                        event.ctrlKey ||
                        event.metaKey ||
                        event.altKey ||
                        !(event.target instanceof HTMLInputElement)
                      ) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      event.target.blur();
                      document
                        .querySelector<HTMLElement>(
                          '[data-song-slide][aria-selected="true"], [data-song-slide]',
                        )
                        ?.focus();
                    }}
                  >
                    <MediaProperties
                      item={file}
                      disabled={media.document?.access !== 'editable'}
                    />
                  </div>
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
              {card === undefined &&
              liturgy !== null &&
              liturgyLayer !== null &&
              liturgyTheme !== undefined ? (
                <>
                  <div className={styles.picture} data-background-picture>
                    <div className={styles.canvas}>
                      <SlidePicture
                        output
                        {...liturgyTheme}
                        slide={liturgyLayer}
                      />
                    </div>
                  </div>
                  <div className={styles.caption} style={labelInk('none')}>
                    {LITURGY[liturgy.liturgy.kind].name}
                    <span>
                      {position + 1} / {count}
                    </span>
                  </div>
                </>
              ) : null}
              {tile === undefined ||
              layer === null ||
              appearance === undefined ? null : (
                <>
                  <div className={styles.picture} data-background-picture>
                    <div className={styles.canvas}>
                      {tile.sermonTitle === true &&
                      sermonTheme !== undefined ? (
                        <SlidePicture output {...sermonTheme} slide={layer} />
                      ) : (
                        <SlidePicture
                          output
                          themeId={appearance.theme.themeId}
                          screen={appearance.screen}
                          slide={layer}
                          layout={appearance.theme.layout}
                          emptyColor={appearance.theme.emptyColor}
                          item={appearance.theme.item}
                        />
                      )}
                    </div>
                  </div>
                  <div
                    className={styles.caption}
                    style={labelInk(tile.labelColor)}
                  >
                    {tile.label ?? ''}
                    <span>
                      {index + 1} / {tiles.length}
                    </span>
                  </div>
                </>
              )}
              {(selectedCard !== undefined ||
                part != null ||
                selectedParts.length > 0 ||
                selectedTitles.length > 0 ||
                (liturgy !== null && liturgyIndex >= 0)) &&
              service !== null ? (
                <div
                  onKeyDown={event => {
                    if (
                      (!bible &&
                        liturgy === null &&
                        changeSelected === undefined) ||
                      busy ||
                      service.access !== 'editable' ||
                      event.nativeEvent.isComposing ||
                      event.altKey ||
                      !(event.ctrlKey || event.metaKey)
                    ) {
                      return;
                    }
                    const key = event.key.toLowerCase();
                    if (key !== 'z' && key !== 'y') return;
                    event.preventDefault();
                    event.stopPropagation();
                    const action =
                      key === 'y' || event.shiftKey ? 'redo' : 'undo';
                    if (bible || liturgy !== null) {
                      editorTask(items.replayItemEdit(action));
                    } else editor.getSnapshot().session?.edit(action);
                  }}
                >
                  <Properties>
                    <TransitionPicker
                      value={value}
                      allowAll={
                        bible || liturgy !== null || applyAll !== undefined
                      }
                      mixed={mixed}
                      disabled={busy || service.access !== 'editable'}
                      selectionKey={selectedParts
                        .map(
                          entry =>
                            `${entry.reference.book}:${entry.reference.chapter}:${entry.reference.verse}:${entry.part}`,
                        )
                        .join(',')}
                      onChange={changeTransition}
                      onSeconds={sec => changeTransition(sec)}
                      onApplyAll={() => {
                        if (applyAll === undefined) {
                          changeTransition(value, true);
                        } else applyAll(value);
                      }}
                    />
                  </Properties>
                </div>
              ) : null}
            </div>
          }
        />
      </PanelBody>
    </Panel>
  );
}
