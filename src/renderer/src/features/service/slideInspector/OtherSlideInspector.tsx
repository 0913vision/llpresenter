import {useState, useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind} from '@core/schema/service';
import {
  biblePartEffect,
  biblePartLabel,
  setBiblePartEffect,
  setBiblePartLabel,
} from '@core/bible/partTransitions';
import type {SlideTransition} from '@core/schema/slideTransition';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {inspectorTransition} from './TransitionSection';
import {cardOffset, hasSectionCard} from '@core/services/sectionCards';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {useShow} from '@renderer/session/show';
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {sermonPreviewRow} from '@renderer/platform/sermonPreview';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {
  biblePictureInput,
  cardPictureLayer,
} from '@renderer/rendering/pictureSpec';
import {SlideInspectorView} from './SlideInspectorView';
import type {MediaItem} from '@core/schema/mediaList';
import {MediaProperties} from '@renderer/features/media/MediaPropertiesPanel';
import {labelInk} from '@renderer/ui/labelInk';
import {LITURGY} from '@core/services/liturgy';
import {LITURGY_SLIDES} from '@core/services/liturgySlides';
import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {useItemMedia, useItemSettings} from '../items/useItemSources';
import {savedItemTiles, savedPassageTiles} from '../items/bibleItemModel';
import type {ServiceItemStore} from '../items/serviceItemStore';
import styles from './SlideInspector.module.css';
import {RolePreview} from '@renderer/features/songs/editor/RolePreview';
import {
  PREVIEW_ROLES,
  previewAppearance,
  type PreviewRole,
} from '@renderer/features/songs/editor/songPreviewModel';
import {withPreferenceDefaults} from '@core/schema/preferences';

function OtherRolePicture({
  mode,
  role,
  item,
  card,
  liturgy,
  liturgyLayer,
  layer,
  tile,
  file,
  editor,
  baseAppearance,
}: {
  readonly mode: 'file' | 'card' | 'liturgy' | 'bible';
  readonly role: PreviewRole;
  readonly item: NonNullable<
    ReturnType<ServiceItemStore['getSnapshot']>['item']
  >;
  readonly card: import('@core/schema/service').SectionCard | undefined;
  readonly liturgy:
    import('@core/schema/service').ServiceItemOf<'liturgy'> | null;
  readonly liturgyLayer: ReturnType<typeof slideLayerOf>;
  readonly layer: ReturnType<typeof slideLayerOf>;
  readonly tile: import('@core/schema/showService').ShowTile | undefined;
  readonly file: MediaItem | undefined;
  readonly editor: SongEditorStore;
  readonly baseAppearance: NonNullable<
    ReturnType<typeof useBibleTileProjection>
  >['appearance'];
}): JSX.Element {
  const themes = useItemSettings(editor.api.settings, 'themes');
  const screens = useItemSettings(editor.api.settings, 'screens');
  const preferences = useItemSettings(
    editor.api.settings,
    'preferences',
    role === 'stage',
  );
  const cardTheme = useSlideTheme(
    card === undefined
      ? undefined
      : {
          id: item.id,
          kind: 'slides',
          form: 'blank',
          title: card.name,
          theme: card.theme,
        },
    'service',
    {role},
  );
  const liturgyTheme = useSlideTheme(
    liturgy === null
      ? undefined
      : {
          id: liturgy.id,
          kind: 'slides',
          form: 'blank',
          title: LITURGY[liturgy.liturgy.kind].name,
          theme: liturgy.theme ?? CREED_PRAYER_THEME_ID,
        },
    'service',
    {role},
  );
  const sermonTheme = useSlideTheme(
    isItemOfKind(item, 'sermon')
      ? sermonPreviewRow(item.id, item.sermon.passage.ref)
      : undefined,
    'service',
    {role},
  );
  const mediaTheme = useSlideTheme(
    isItemOfKind(item, 'media')
      ? {
          id: item.id,
          kind: 'media',
          title: file?.name ?? '',
          ...(item.theme === undefined ? {} : {theme: item.theme}),
        }
      : undefined,
    'service',
    {role},
  );
  const appearance =
    baseAppearance?.theme.item === undefined
      ? undefined
      : previewAppearance({
          role,
          themes:
            themes.document?.name === 'themes'
              ? themes.document.value
              : undefined,
          screens:
            screens.document?.name === 'screens'
              ? screens.document.value
              : undefined,
          stageLyricLabelPosition:
            preferences.document?.name === 'preferences'
              ? withPreferenceDefaults(preferences.document.value).output
                  .stageLyricLabelPosition
              : undefined,
          item: {
            ...baseAppearance.theme.item,
            ...(item.theme === undefined ? {} : {theme: item.theme}),
          },
        });
  let picture: JSX.Element | null = null;
  if (
    mode === 'file' &&
    file !== undefined &&
    file.kind !== 'audio' &&
    mediaTheme !== undefined
  ) {
    picture = (
      <SlidePicture
        {...mediaTheme}
        mediaOnly
        background={file.id}
        slide={{itemId: item.id, position: 0, label: null, lines: []}}
      />
    );
  } else if (mode === 'card' && card !== undefined && cardTheme !== undefined) {
    picture = (
      <SlidePicture {...cardTheme} slide={cardPictureLayer(item.id, card, item.textOverrides?.['section'])} />
    );
  } else if (
    mode === 'liturgy' &&
    liturgy !== null &&
    liturgyLayer !== null &&
    liturgyTheme !== undefined
  ) {
    picture = <SlidePicture {...liturgyTheme} slide={liturgyLayer} />;
  } else if (
    mode === 'bible' &&
    tile !== undefined &&
    layer !== null &&
    appearance !== undefined
  ) {
    picture =
      tile.sermonTitle === true && sermonTheme !== undefined ? (
        <SlidePicture {...sermonTheme} slide={layer} />
      ) : (
        <SlidePicture {...biblePictureInput(layer, appearance)} />
      );
  }
  return (
    <div className={styles.picture} data-background-picture>
      <div className={styles.canvas}>{picture}</div>
    </div>
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
}: {
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
  const [big, setBig] = useState<PreviewRole>('audience');
  const current = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const editorState = useSyncExternalStore(
    editor.subscribe,
    editor.getSnapshot,
  );
  const state =
    shownItem !== undefined &&
    (shownItem.item?.id !== current.item?.id ||
      shownItem.service?.service.id !== current.service?.service.id)
      ? shownItem
      : current;
  const {item, service, position, busy, bibleSelection, cardSelected} = state;
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
  const liturgyIndices = (
    liturgy === null
      ? []
      : bibleSelection.length > 0
        ? bibleSelection
        : liturgyIndex >= 0 && !cardSelected
          ? [liturgyIndex]
          : []
  ).filter(
    index =>
      liturgy !== null &&
      index >= 0 &&
      index <
        LITURGY_SLIDES[liturgy.liturgy.kind][liturgy.liturgy.translation]
          .length,
  );
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
    shownItem === undefined
      ? savedPassageTiles(
          view,
          service?.service.id,
          bible ? item.id : undefined,
        )
      : savedItemTiles(view, service?.service.id, bible ? item.id : undefined),
  );
  const projection = useBibleTileProjection({
    anyItem: shownItem !== undefined,
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
  const cardColor =
    editorState.labels?.value.labels.find(label => label.name === card?.label)
      ?.color ?? 'none';
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
    item !== null && cardSelected && hasSectionCard(item)
      ? item.sectionCard
      : card;
  const selectedLabels = [
    ...(item !== null &&
    isItemOfKind(item, 'media') &&
    file !== undefined &&
    file.kind !== 'audio'
      ? [item.slideLabel]
      : []),
    ...(selectedCard === undefined
      ? []
      : [
          cardLabel === undefined
            ? selectedCard.label
            : (cardLabel ?? undefined),
        ]),
    ...(bible
      ? selectedParts.map(part =>
          biblePartLabel(item.bibleLabels, part.reference, part.part),
        )
      : []),
    ...(item !== null && isItemOfKind(item, 'sermon')
      ? selectedTitles.map(index =>
          index === 0 ? item.sermon.openingLabel : item.sermon.closingLabel,
        )
      : []),
    ...liturgyIndices.map(
      index =>
        liturgy?.liturgy.labels?.find(entry => entry.index === index)?.label,
    ),
  ];
  const selectedLabel = selectedLabels[0];
  const mixedLabels = selectedLabels.some(label => label !== selectedLabel);
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
    ...(liturgy === null
      ? []
      : liturgyIndices.map(
          index =>
            liturgy.liturgy.transitions?.find(entry => entry.index === index)
              ?.transition ?? {kind: 'none' as const, sec: 0.5},
        )),
  ];
  const {value, mixed} = inspectorTransition(values);
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
        failure: '전환 저장 실패',
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
                    ? old === undefined
                      ? undefined
                      : {...old, sec: next}
                    : next;
                sermon =
                  effect === undefined ? sermon : {...sermon, [key]: effect};
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
          if (
            isItemOfKind(updated, 'liturgy') &&
            (liturgyIndices.length > 0 || all)
          ) {
            const indices = all
              ? (liturgyTiles ?? [])
                  .slice(cardOffset(updated))
                  .map((_, index) => index)
              : liturgyIndices;
            let transitions = [...(updated.liturgy.transitions ?? [])];
            for (const index of indices) {
              const old = transitions.find(
                entry => entry.index === index,
              )?.transition;
              const effect =
                typeof next === 'number'
                  ? old === undefined
                    ? undefined
                    : {...old, sec: next}
                  : next;
              transitions =
                effect === undefined
                  ? transitions
                  : [
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
  const hasSelection =
    selectedCard !== undefined ||
    part != null ||
    selectedParts.length > 0 ||
    selectedTitles.length > 0 ||
    liturgyIndices.length > 0 ||
    (item !== null &&
      isItemOfKind(item, 'media') &&
      file !== undefined &&
      file.kind !== 'audio');
  const changeItemLabel = (name: string | undefined): void => {
    if (item === null || service === null) return;

    if (changeLabel !== undefined) {
      changeLabel(name);
      return;
    }
    editorTask(
      items.submitItemEdit({
        target: {
          serviceId: service.service.id,
          itemId: item.id,
        },
        failure: '이름표 저장 실패',
        change: current => {
          let updated = current;
          if (isItemOfKind(updated, 'media')) {
            const {slideLabel: _label, ...rest} = updated;
            return {
              ...rest,
              ...(name === undefined ? {} : {slideLabel: name}),
            };
          }
          if (selectedCard !== undefined && hasSectionCard(updated)) {
            const {label: _label, ...card} = updated.sectionCard;
            updated = {
              ...updated,
              sectionCard: {
                ...card,
                ...(name === undefined ? {} : {label: name}),
              },
            };
          }
          if (
            isItemOfKind(updated, 'bible') ||
            isItemOfKind(updated, 'sermon')
          ) {
            let labels = updated.bibleLabels ?? [];
            for (const part of selectedParts) {
              labels = setBiblePartLabel(
                labels,
                {verse: part.reference, part: part.part},
                name,
              );
            }
            if (isItemOfKind(updated, 'sermon') && selectedTitles.length > 0) {
              const {openingLabel, closingLabel, ...sermon} = updated.sermon;
              const opening = selectedTitles.includes(0) ? name : openingLabel;
              const closing = selectedTitles.some(index => index !== 0)
                ? name
                : closingLabel;
              updated = {
                ...updated,
                sermon: {
                  ...sermon,
                  ...(opening === undefined ? {} : {openingLabel: opening}),
                  ...(closing === undefined ? {} : {closingLabel: closing}),
                },
              };
            }
            return {...updated, bibleLabels: labels};
          }
          if (isItemOfKind(updated, 'liturgy')) {
            const labels = (updated.liturgy.labels ?? []).filter(
              entry => !liturgyIndices.includes(entry.index),
            );
            if (name !== undefined) {
              labels.push(
                ...liturgyIndices.map(index => ({
                  index,
                  label: name,
                })),
              );
            }
            return {
              ...updated,
              liturgy: {...updated.liturgy, labels},
            };
          }
          return updated;
        },
      }),
    );
  };
  const renderPreview = (
    mode: 'file' | 'card' | 'liturgy' | 'bible',
  ): JSX.Element | null =>
    item === null ? null : (
      <RolePreview
        big={big}
        onBigChange={setBig}
        naturalHeight
        renderRole={role => (
          <OtherRolePicture
            mode={mode}
            role={role}
            item={item}
            card={card}
            liturgy={liturgy}
            liturgyLayer={liturgyLayer}
            layer={layer}
            tile={tile}
            file={file}
            editor={editor}
            baseAppearance={appearance}
          />
        )}
        caption={role =>
          PREVIEW_ROLES.find(entry => entry.value === role)?.label
        }
      />
    );
  return (
    <SlideInspectorView
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
      pictureCount={pictureCount * 3}
      preview={
        <>
          {file === undefined || file.kind === 'audio' ? null : (
            <>
              {renderPreview('file')}
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
              {renderPreview('card')}
              <div className={styles.caption} style={labelInk(cardColor)}>
                {card.label ?? card.name}
                <span>1 / {count}</span>
              </div>
            </>
          )}
          {card === undefined &&
          liturgy !== null &&
          liturgyLayer !== null &&
          liturgyTheme !== undefined ? (
            <>
              {renderPreview('liturgy')}
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
              {renderPreview('bible')}
              <div className={styles.caption} style={labelInk(tile.labelColor)}>
                {tile.slideLabel ?? tile.label ?? ''}
                <span>
                  {index + 1} / {tiles.length}
                </span>
              </div>
            </>
          )}
        </>
      }
      adapter={{
        selectedIds: [
          ...(selectedCard === undefined ? [] : ['card']),
          ...selectedParts.map(
            part => `bible:${JSON.stringify([part.reference, part.part])}`,
          ),
          ...selectedTitles.map(
            index => `sermon:${index === 0 ? 'opening' : 'closing'}`,
          ),
          ...liturgyIndices.map(index => `liturgy:${index}`),
          ...(file === undefined ? [] : [`media:${file.id}`]),
        ],
        label:
          !hasSelection || service === null || selectedLabels.length === 0
            ? undefined
            : {
                store: editor,
                value: selectedLabel,
                mixed: mixedLabels,
                disabled: busy || service.access !== 'editable',
                change: changeItemLabel,
              },
        transition:
          !hasSelection ||
          service === null ||
          (item !== null && isItemOfKind(item, 'media'))
            ? undefined
            : {
                value,
                mixed,
                disabled: busy || service.access !== 'editable',
                allowAll: bible || liturgy !== null || applyAll !== undefined,
                selectionKey: `${item?.id ?? ''}:${position}:${cardSelected}:${selectedIndices.join(',')}`,
                onChange: changeTransition,
                onSeconds: sec => changeTransition(sec),
                onApplyAll: () => {
                  if (applyAll === undefined) changeTransition(value, true);
                  else applyAll(value);
                },
              },
        undo:
          !hasSelection ||
          (!bible &&
            liturgy === null &&
            changeSelected === undefined &&
            replayDraft === undefined)
            ? undefined
            : action => {
                if (replayDraft !== undefined) replayDraft(action);
                else if (bible || liturgy !== null) {
                  editorTask(items.replayItemEdit(action));
                } else editor.getSnapshot().session?.edit(action);
              },
        undoDisabled: busy || service?.access !== 'editable',
      }}
    />
  );
}
