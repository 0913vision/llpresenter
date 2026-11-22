import {useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import type {ShowTile} from '@core/schema/showService';
import type {SlideTransition} from '@core/schema/slideTransition';
import type {MediaItem} from '@core/schema/mediaList';
import {hasSectionCard} from '@core/services/sectionCards';
import {
  changeBibleSlides,
  isPassageItem,
  passageOf,
  slideIds,
  withPassage,
} from '@core/services/passageEdits';
import {liturgySlideTextKey} from '@core/services/liturgy';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {MediaProperties} from '@renderer/features/media/MediaPropertiesPanel';
import {itemThemes, useThemeSettings} from '@renderer/pictures/itemThemes';
import {TilePicture} from '@renderer/pictures/TilePicture';
import {useShow} from '@renderer/session/show';
import {labelInk} from '@renderer/ui/labelInk';
import {useItemMedia} from '../items/useItemSources';
import type {ServiceItemStore} from '../items/serviceItemStore';
import {BibleSlideFields} from '../items/BibleSlideFields';
import {CardFields} from '../items/CardFields';
import {SermonTitleFields} from '../items/SermonTitleFields';
import type {RenderSlideTextFields} from '@renderer/features/songs/editor/SlideCardRenderer';
import {SlideInspectorView} from './SlideInspectorView';
import {inspectorTransition} from './TransitionSection';
import styles from './SlideInspector.module.css';

const NO_TILES: readonly ShowTile[] = [];
const CUT: SlideTransition = {kind: 'none', sec: 0.5};

function InspectorMediaPicture({
  file,
}: {
  readonly file: MediaItem;
}): JSX.Element {
  return (
    <img
      className={styles.mediaPicture}
      src={file.kind === 'video' ? thumbnailSrc(file.id) : mediaUrl(file.id)}
      alt=""
      onError={event => {
        event.currentTarget.style.visibility = 'hidden';
      }}
      onLoad={event => {
        event.currentTarget.style.visibility = '';
      }}
    />
  );
}

/** The slides of an item that are selected in its editor. */
function selectedTiles(
  item: ServiceItem,
  tiles: readonly ShowTile[],
  {
    position,
    selection,
    cardSelected,
  }: {
    readonly position: number;
    readonly selection: readonly number[];
    readonly cardSelected: boolean;
  },
): readonly ShowTile[] {
  const offset = hasSectionCard(item) ? 1 : 0;
  const indices = new Set(selection.map(index => index + offset));
  if (indices.size === 0) indices.add(position);
  if (cardSelected && hasSectionCard(item)) indices.add(0);
  return tiles.filter((_, index) => indices.has(index));
}

/** Changes the transition of these slides, or only its seconds. */
function withTransition(
  item: ServiceItem,
  slides: readonly ShowTile[],
  next: SlideTransition | number,
): ServiceItem {
  const keys = new Set(slides.map(tile => tile.key));
  const effect = (
    old: SlideTransition | undefined,
  ): SlideTransition | undefined =>
    typeof next === 'number'
      ? old === undefined
        ? undefined
        : {...old, sec: next}
      : next;
  let updated = item;
  if (keys.has('section') && hasSectionCard(updated)) {
    const transition = effect(updated.sectionCard.transition);
    if (transition !== undefined) {
      updated = {
        ...updated,
        sectionCard: {...updated.sectionCard, transition},
      };
    }
  }
  if (isPassageItem(updated)) {
    const passage = passageOf(updated);
    if (passage.slides !== undefined) {
      updated = withPassage(updated, {
        ...passage,
        slides: changeBibleSlides(passage.slides, slideIds(slides), slide => {
          const transition = effect(slide.transition ?? passage.transition);
          return transition === undefined ? slide : {...slide, transition};
        }),
      });
    }
  }
  if (isItemOfKind(updated, 'sermon')) {
    const {openingTransition, closingTransition, ...sermon} = updated.sermon;
    const opening = keys.has('sermon:opening')
      ? (effect(openingTransition) ?? openingTransition)
      : openingTransition;
    const closing = keys.has('sermon:closing')
      ? (effect(closingTransition) ?? closingTransition)
      : closingTransition;
    updated = {
      ...updated,
      sermon: {
        ...sermon,
        ...(opening === undefined ? {} : {openingTransition: opening}),
        ...(closing === undefined ? {} : {closingTransition: closing}),
      },
    };
  }
  if (isItemOfKind(updated, 'liturgy')) {
    const {liturgy} = updated;
    const before = liturgy.transitions ?? [];
    const changed = liturgyIndices(updated, slides).flatMap(index => {
      const transition = effect(
        before.find(entry => entry.index === index)?.transition,
      );
      return transition === undefined ? [] : [{index, transition}];
    });
    updated = {
      ...updated,
      liturgy: {
        ...liturgy,
        transitions: [
          ...before.filter(
            entry => !changed.some(each => each.index === entry.index),
          ),
          ...changed,
        ],
      },
    };
  }
  return updated;
}

/** Gives these slides a 이름표, or takes it away. */
function withLabel(
  item: ServiceItem,
  slides: readonly ShowTile[],
  name: string | undefined,
): ServiceItem {
  const keys = new Set(slides.map(tile => tile.key));
  const own = name === undefined ? {} : {label: name};
  let updated = item;
  if (isItemOfKind(updated, 'media')) {
    const {slideLabel: _label, ...rest} = updated;
    return {...rest, ...(name === undefined ? {} : {slideLabel: name})};
  }
  if (keys.has('section') && hasSectionCard(updated)) {
    const {label: _label, ...card} = updated.sectionCard;
    updated = {...updated, sectionCard: {...card, ...own}};
  }
  if (isPassageItem(updated)) {
    const passage = passageOf(updated);
    if (passage.slides !== undefined) {
      updated = withPassage(updated, {
        ...passage,
        slides: changeBibleSlides(
          passage.slides,
          slideIds(slides),
          ({label: _label, ...slide}) => ({...slide, ...own}),
        ),
      });
    }
  }
  if (isItemOfKind(updated, 'sermon')) {
    const {openingLabel, closingLabel, ...sermon} = updated.sermon;
    const opening = keys.has('sermon:opening') ? name : openingLabel;
    const closing = keys.has('sermon:closing') ? name : closingLabel;
    updated = {
      ...updated,
      sermon: {
        ...sermon,
        ...(opening === undefined ? {} : {openingLabel: opening}),
        ...(closing === undefined ? {} : {closingLabel: closing}),
      },
    };
  }
  if (isItemOfKind(updated, 'liturgy')) {
    const indices = liturgyIndices(updated, slides);
    updated = {
      ...updated,
      liturgy: {
        ...updated.liturgy,
        labels: [
          ...(updated.liturgy.labels ?? []).filter(
            entry => !indices.includes(entry.index),
          ),
          ...(name === undefined
            ? []
            : indices.map(index => ({index, label: name}))),
        ],
      },
    };
  }
  return updated;
}

function liturgyIndices(
  item: Extract<ServiceItem, {readonly liturgy: unknown}>,
  slides: readonly ShowTile[],
): readonly number[] {
  const keys = new Set(slides.map(tile => tile.key));
  return Array.from({length: 200}, (_, index) => index).filter(index =>
    keys.has(liturgySlideTextKey(item.liturgy, index)),
  );
}

/** Adapts a selected Bible, liturgy, card or media item to the shared inspector. */
export function OtherSlideInspector({
  items,
  editor,
  applyAll,
  changeSelected,
  cardTransition,
  cardLabel,
  changeLabel,
  replayDraft,
  shownItem,
  renderTextFields,
}: {
  readonly renderTextFields?: RenderSlideTextFields | undefined;
  readonly changeSelected?:
    ((change: SlideTransition | number) => void) | undefined;
  readonly cardTransition?: SlideTransition | null | undefined;
  readonly cardLabel?: string | null | undefined;
  readonly changeLabel?: ((name: string | undefined) => void) | undefined;
  readonly replayDraft?: ((action: 'undo' | 'redo') => void) | undefined;
  readonly applyAll?: ((transition: SlideTransition) => void) | undefined;
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly shownItem?: ReturnType<ServiceItemStore['getSnapshot']> | undefined;
}): JSX.Element {
  const current = useSyncExternalStore(items.subscribe, items.getSnapshot);
  useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const state =
    shownItem !== undefined &&
    (shownItem.item?.id !== current.item?.id ||
      shownItem.service?.service.id !== current.service?.service.id)
      ? shownItem
      : current;
  const {item, service, position, busy, bibleSelection, cardSelected} = state;
  const row = useShow(view => view.rows.find(entry => entry.id === item?.id));
  const tiles = useShow(view =>
    item === null ? NO_TILES : (view.tiles[item.id] ?? NO_TILES),
  );
  const settings = useThemeSettings();
  const media = useItemMedia(
    editor.api.media,
    item !== null && isItemOfKind(item, 'media'),
  );
  if (item === null || service === null) return <SlideInspectorView />;
  const passage = isPassageItem(item);
  const liturgy = isItemOfKind(item, 'liturgy');
  const file = isItemOfKind(item, 'media')
    ? media.document?.value.items.find(
        entry => entry.id === item.media && entry.kind !== 'audio',
      )
    : undefined;
  const selected = selectedTiles(item, tiles, {
    position,
    selection: bibleSelection,
    cardSelected,
  });
  const tile = tiles[position];
  const labels = selected.map(each =>
    each.key === 'section' && cardLabel !== undefined
      ? (cardLabel ?? undefined)
      : each.slideLabel,
  );
  const {value, mixed} = inspectorTransition(
    selected.map(each =>
      each.key === 'section' && cardTransition !== undefined
        ? (cardTransition ?? CUT)
        : (each.transition ?? CUT),
    ),
  );
  const disabled = busy || service.access !== 'editable';
  const submit = (
    failure: string,
    change: (fresh: ServiceItem) => ServiceItem,
  ): void =>
    editorTask(
      items.submitItemEdit({
        target: {serviceId: service.service.id, itemId: item.id},
        failure,
        change,
      }),
    );
  const changeTransition = (
    next: SlideTransition | number,
    all = false,
  ): void => {
    if (!all && changeSelected !== undefined) changeSelected(next);
    else {
      submit('전환 저장 실패', fresh =>
        withTransition(fresh, all ? tiles : selected, next),
      );
    }
  };
  if (selected.length === 0 && file === undefined) {
    return <SlideInspectorView />;
  }
  return (
    <SlideInspectorView
      identity={`${item.id}:${position}:${bibleSelection.join(',')}:${cardSelected}`}
      preview={
        file === undefined ? (
          tile === undefined ? null : (
            <>
              <div className={styles.picture} data-background-picture>
                <div className={styles.canvas}>
                  <TilePicture
                    tile={tile}
                    slide={slideLayerOf(
                      {itemId: item.id, index: position},
                      () => tiles,
                    )}
                    themes={itemThemes(row, tiles, settings)}
                  />
                </div>
              </div>
              <div className={styles.caption} style={labelInk(tile.labelColor)}>
                {tile.slideLabel ?? tile.label ?? ''}
                <span>
                  {position + 1} / {tiles.length}
                </span>
              </div>
            </>
          )
        ) : (
          <>
            <div className={styles.picture} data-background-picture>
              <InspectorMediaPicture key={file.id} file={file} />
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
        )
      }
      text={
        tile === undefined ? null : (
          <div className={styles.text}>
            {hasSectionCard(item) && tile.sectionCard !== undefined ? (
              <CardFields
                key={item.id}
                items={items}
                serviceId={service.service.id}
                itemId={item.id}
                card={item.sectionCard}
                readOnly={disabled}
              />
            ) : isItemOfKind(item, 'sermon') && tile.sermonTitle === true ? (
              <SermonTitleFields
                items={items}
                serviceId={service.service.id}
                item={item}
                readOnly={disabled}
              />
            ) : isPassageItem(item) ? (
              <BibleSlideFields
                items={items}
                serviceId={service.service.id}
                item={item}
                lookup={row?.kind === 'bible' ? row.bible?.passage : undefined}
                tile={tile}
                readOnly={disabled}
              />
            ) : null}
            {tile.key === undefined ? null : renderTextFields?.(tile.key)}
          </div>
        )
      }
      adapter={{
        selectedIds: selected.map((each, index) => each.key ?? String(index)),
        label: {
          store: editor,
          value: labels[0],
          mixed: labels.some(label => label !== labels[0]),
          disabled,
          change: name => {
            if (changeLabel !== undefined) changeLabel(name);
            else {
              submit('이름표 저장 실패', fresh =>
                withLabel(fresh, selected, name),
              );
            }
          },
        },
        transition: isItemOfKind(item, 'media')
          ? undefined
          : {
              value,
              mixed,
              disabled,
              allowAll: passage || liturgy || applyAll !== undefined,
              selectionKey: `${item.id}:${position}:${cardSelected}:${bibleSelection.join(',')}`,
              onChange: changeTransition,
              onSeconds: sec => changeTransition(sec),
              onApplyAll: () => {
                if (applyAll === undefined) changeTransition(value, true);
                else applyAll(value);
              },
            },
        undo:
          !passage &&
          !liturgy &&
          changeSelected === undefined &&
          replayDraft === undefined
            ? undefined
            : action => {
                if (replayDraft !== undefined) replayDraft(action);
                else if (passage || liturgy) {
                  editorTask(items.replayItemEdit(action));
                } else editor.getSnapshot().session?.edit(action);
              },
        undoDisabled: disabled,
      }}
    />
  );
}
