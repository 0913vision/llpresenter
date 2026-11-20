import {useSyncExternalStore, type JSX} from 'react';
import type {SlideTransition} from '@core/schema/slideTransition';
import type {LlpApi} from '@contracts/ipc/api';
import {useItemMedia} from '../items/useItemSources';
import {useSlidesVerseProjection} from '../../bible/useSlidesVerseProjection';
import {
  SlidesCanvas,
  slideBand,
  useSlidesAppearance,
  useSlidesItemWithBackground,
} from '../slides/SlidesVisuals';
import type {SlidesListSession} from '../slides/slidesListSession';
import {SlideInspectorView} from './SlideInspectorView';
import {inspectorTransition, useTransitionSelection} from './TransitionSection';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import styles from './SlideInspector.module.css';

/** Adapts a local slide draft and selection to the shared inspector. */
export function SlidesInspector({
  api,
  session,
  store,
  onApplyAll,
  cardSelected = false,
}: {
  readonly cardSelected?: boolean;
  readonly onApplyAll?: ((transition: SlideTransition) => void) | undefined;
  readonly api: LlpApi;
  readonly session: SlidesListSession;
  readonly store?: SongEditorStore | undefined;
}): JSX.Element {
  const view = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const {item: draftItem, selected} = session.draft.snapshot;
  const item = useSlidesItemWithBackground(draftItem);
  const media = useItemMedia(api.media).document?.value.items ?? [];
  const {appearance, ready} = useSlidesAppearance(api, item);
  const {projection} = useSlidesVerseProjection(api, item);
  const slide = view.slides[selected];
  const card = cardSelected ? draftItem.sectionCard : undefined;
  const selectedSlides = view.slides.filter(entry =>
    view.selection.ids.has(entry.id),
  );
  const labels = [
    ...(card === undefined ? [] : [card.label]),
    ...selectedSlides.map(entry => entry.label),
  ];
  const label = labels[0];
  const mixedLabel = labels.some(entry => entry !== label);
  const effects = [
    ...(card === undefined
      ? []
      : [card.transition ?? {kind: 'none' as const, sec: 0.5}]),
    ...selectedSlides.map(
      entry => entry.transition ?? {kind: 'none' as const, sec: 0.5},
    ),
  ];
  const {value, mixed} = inspectorTransition(effects);
  const transition = useTransitionSelection({
    session,
    disabled: false,
    onApplyAll,
  });
  const applySelected = (change: SlideTransition | number): void => {
    const current = session.draft.snapshot.item;
    const update = (
      old: SlideTransition | undefined,
    ): SlideTransition | undefined =>
      typeof change === 'number'
        ? old === undefined
          ? undefined
          : {...old, sec: change}
        : change;
    const cardEffect = update(current.sectionCard?.transition);
    const sectionCard =
      current.sectionCard === undefined ||
      !cardSelected ||
      cardEffect === undefined
        ? current.sectionCard
        : {...current.sectionCard, transition: cardEffect};
    const slides = current.slides.slides.map(entry => {
      if (!view.selection.ids.has(entry.id)) return entry;
      const next = update(entry.transition);
      return next === undefined ? entry : {...entry, transition: next};
    });
    session.draft.change(
      {
        ...current,
        ...(sectionCard === undefined ? {} : {sectionCard}),
        slides: {...current.slides, slides},
      },
      selected,
      'transition-selected',
    );
    session.draft.endTyping();
  };
  const applyLabel = (name: string | undefined): void => {
    if (!cardSelected) {
      session.commandSlides({type: 'label', label: name});
      return;
    }
    const current = session.draft.snapshot.item;
    const card = current.sectionCard;
    if (card === undefined) return;
    const {label: _cardLabel, ...cardWithoutLabel} = card;
    const slides = current.slides.slides.map(entry => {
      if (!view.selection.ids.has(entry.id)) return entry;
      const {label: _label, ...rest} = entry;
      return {...rest, ...(name === undefined ? {} : {label: name})};
    });
    session.draft.change(
      {
        ...current,
        sectionCard: {
          ...cardWithoutLabel,
          ...(name === undefined ? {} : {label: name}),
        },
        slides: {...current.slides, slides},
      },
      selected,
      'label-selected',
    );
    session.draft.endTyping();
  };

  if (view.selection.ids.size === 0 || slide === undefined) {
    return <SlideInspectorView />;
  }
  return (
    <SlideInspectorView
      identity={`${item.id}:${selected}:${selectedSlides.map(entry => entry.id).join(',')}:${cardSelected}`}
      pending={!ready}
      waitForPicture
      preview={
        <>
          <div className={styles.picture} data-background-picture>
            <SlidesCanvas
              item={item}
              index={selected}
              appearance={appearance}
              projection={projection}
            />
          </div>
          <div className={styles.caption}>
            {slideBand(slide, media)}
            <span>
              {selected + 1} / {view.slides.length}
            </span>
          </div>
        </>
      }
      adapter={{
        selectedIds: [
          ...(card === undefined ? [] : ['card']),
          ...selectedSlides.map(entry => entry.id),
        ],
        label:
          store === undefined
            ? undefined
            : {
                store,
                value: label,
                mixed: mixedLabel,
                disabled: session.readOnly || selectedSlides.length === 0,
                change: applyLabel,
              },
        transition:
          card === undefined
            ? transition
            : {
                value,
                mixed,
                disabled: session.readOnly,
                selectionKey: selectedSlides.map(entry => entry.id).join(','),
                onChange: applySelected,
                onSeconds: applySelected,
                onApplyAll: () => onApplyAll?.(value),
                allowAll: onApplyAll !== undefined,
              },
        undo: action => session.edit(action),
        undoDisabled: session.readOnly,
      }}
    />
  );
}
