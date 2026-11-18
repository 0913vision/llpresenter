import {useState, useSyncExternalStore, type JSX} from 'react';
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
import {Panel, PanelBody} from '@renderer/ui/Panel';
import {Properties, PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {PrepInspectorContent} from './PrepInspectorContent';
import {TransitionPicker, TransitionRows} from './TransitionRows';
import {slideTransitionUndo} from '@renderer/features/songs/editor/slideTransitionSelection';
import {LabelMenu} from '@renderer/features/songs/editor/LabelMenu';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {Button} from '@renderer/ui/Button';
import styles from './SlideInspector.module.css';

/** Inspect a local slide item through its existing draft and selection. */
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
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
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
  const label = selectedSlides[0]?.label;
  const mixedLabel = selectedSlides.some(entry => entry.label !== label);
  const effects = [
    ...(card === undefined
      ? []
      : [card.transition ?? {kind: 'none' as const, sec: 0.5}]),
    ...selectedSlides.map(
      entry => entry.transition ?? {kind: 'none' as const, sec: 0.5},
    ),
  ];
  const value = effects[0] ?? {kind: 'none' as const, sec: 0.5};
  const mixed = effects.some(
    effect => JSON.stringify(effect) !== JSON.stringify(value),
  );
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

  return (
    <Panel label="슬라이드 속성">
      <PanelBody>
        {view.selection.ids.size === 0 || slide === undefined ? null : (
          <PrepInspectorContent
            identity={`${item.id}:${selected}:${selectedSlides.map(entry => entry.id).join(',')}:${cardSelected}`}
            pending={!ready}
            waitForPicture
            content={
              <div
                onKeyDown={event =>
                  slideTransitionUndo(event, session, session.readOnly)
                }
              >
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
                <Properties>
                  {store === undefined ? null : (
                    <PropertyGroup>
                      <PropertyRow label="이름표">
                        {({controlId}) => (
                          <Button
                            id={controlId}
                            size="md"
                            className={styles.full}
                            disabled={
                              session.readOnly || selectedSlides.length === 0
                            }
                            onClick={event => setAnchor(event.currentTarget)}
                          >
                            {mixedLabel ? '혼합' : (label ?? '없음')}
                          </Button>
                        )}
                      </PropertyRow>
                    </PropertyGroup>
                  )}
                  {card === undefined ? (
                    <TransitionRows
                      session={session}
                      disabled={false}
                      onApplyAll={onApplyAll}
                    />
                  ) : (
                    <TransitionPicker
                      value={value}
                      mixed={mixed}
                      disabled={session.readOnly}
                      selectionKey={selectedSlides
                        .map(entry => entry.id)
                        .join(',')}
                      onChange={applySelected}
                      onSeconds={applySelected}
                      onApplyAll={() => onApplyAll?.(value)}
                      allowAll={onApplyAll !== undefined}
                    />
                  )}
                </Properties>
                {store === undefined || anchor === null ? null : (
                  <LabelMenu
                    store={store}
                    anchor={anchor}
                    selected={mixedLabel ? undefined : label}
                    onChoose={name =>
                      session.commandSlides({type: 'label', label: name})
                    }
                    onClose={restore => {
                      setAnchor(null);
                      if (restore) anchor.focus();
                    }}
                  />
                )}
              </div>
            }
          />
        )}
      </PanelBody>
    </Panel>
  );
}
