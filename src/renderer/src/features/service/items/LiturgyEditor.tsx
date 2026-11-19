import {useRef, useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import {
  LITURGY,
  withLiturgyTranslation,
  type LiturgyTranslation,
} from '@core/services/liturgy';
import {LITURGY_SLIDES} from '@core/services/liturgySlides';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {useShow} from '@renderer/session/show';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {SlideThumbnailBand} from '@renderer/ui/SlideThumbnail';
import {PanelFooter} from '@renderer/ui/Panel';
import {TextArea} from '@renderer/ui/TextArea';
import type {UiApi} from '@contracts/ipc/ui';
import {
  SlideSurfaceView,
  useSlideSurfaceView,
} from '@renderer/features/songs/editor/SlideSurfaceView';
import liturgyStyles from './LiturgyEditor.module.css';
import {useLeadingItemCard} from './useLeadingItemCard';
import {LeadingSlideCardView} from '@renderer/features/songs/editor/LeadingSlideCardView';
import styles from './BibleInlineEditor.module.css';
import {cardOffset} from '@core/services/sectionCards';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {ServiceItemStore} from './serviceItemStore';

/** Changes the church's fixed wording without converting it to editable slides. */
export function LiturgyVersion({
  items,
  item,
  serviceId,
  locked,
}: {
  readonly items: ServiceItemStore;
  readonly item: ServiceItemOf<'liturgy'>;
  readonly serviceId: string;
  readonly locked: boolean;
}): JSX.Element {
  return (
    <SelectMenu
      aria-label="예식문 버전"
      value={item.liturgy.translation}
      disabled={locked}
      options={[
        {value: 'new', label: '새 번역'},
        {value: 'old', label: '옛 번역'},
      ]}
      onChange={value => {
        const translation: LiturgyTranslation = value;
        editorTask(
          items.submitItemEdit({
            target: {serviceId, itemId: item.id},
            failure: '예식문 버전 저장 실패',
            change: current =>
              isItemOfKind(current, 'liturgy')
                ? withLiturgyTranslation(current, translation)
                : null,
          }),
        );
      }}
    />
  );
}

export function LiturgyEditor({
  items,
  shownItem,
  ui,
}: {
  readonly items: ServiceItemStore;
  readonly shownItem?: ReturnType<ServiceItemStore['getSnapshot']> | undefined;
  readonly ui?: Pick<UiApi, 'setLayout'> | undefined;
}): JSX.Element | null {
  const current = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const state =
    shownItem !== undefined &&
    (shownItem.item?.id !== current.item?.id ||
      shownItem.service?.service.id !== current.service?.service.id)
      ? shownItem
      : current;
  const item = state.item;
  if (
    item === null ||
    !isItemOfKind(item, 'liturgy') ||
    state.service === null
  ) {
    return null;
  }
  return (
    <LiturgyContent
      key={item.id}
      items={items}
      item={item}
      position={state.position}
      shownItem={state}
      ui={ui}
    />
  );
}

function LiturgyContent({
  items,
  item,
  position,
  shownItem,
  ui,
}: {
  readonly ui?: Pick<UiApi, 'setLayout'> | undefined;
  readonly items: ServiceItemStore;
  readonly item: ServiceItemOf<'liturgy'>;
  readonly position: number;
  readonly shownItem: ReturnType<ServiceItemStore['getSnapshot']>;
}): JSX.Element {
  const {mode} = useSlideSurfaceView();
  const card = useLeadingItemCard(items, item.id, shownItem);
  const tiles = useShow(view => view.tiles[item.id]);
  const theme = useSlideTheme({
    kind: 'slides',
    form: 'blank',
    id: item.id,
    title: LITURGY[item.liturgy.kind].name,
    theme: item.theme ?? CREED_PRAYER_THEME_ID,
  });
  const texts = LITURGY_SLIDES[item.liturgy.kind][item.liturgy.translation];
  const offset = cardOffset(item);
  const anchor = useRef(Math.max(0, position - offset));
  const selected = (
    shownItem.bibleSelection.length > 0
      ? shownItem.bibleSelection
      : !shownItem.cardSelected && position >= offset
        ? [position - offset]
        : []
  ).filter(index => index >= 0 && index < texts.length);
  return (
    <section
      className={styles.editor}
      aria-label={`${LITURGY[item.liturgy.kind].name} 편집`}
    >
      <div className={styles.surface}>
        <div
          className={`${styles.rows} ${liturgyStyles.rows}`}
          data-view={mode}
          aria-label="슬라이드 편집 목록"
        >
          {card === undefined ? null : (
            <div
              role="option"
              aria-label="타이틀"
              aria-selected={
                shownItem.cardSelected ||
                (position === 0 && selected.length === 0)
              }
              onClick={event => {
                if (event.target instanceof HTMLInputElement) return;
                const ctrl = event.ctrlKey || event.metaKey;
                const alreadySelected =
                  shownItem.cardSelected ||
                  (position === 0 && selected.length === 0);
                if (ctrl && alreadySelected && selected.length > 0) {
                  items.setCardSelected(false);
                  items.selectPosition((selected.at(-1) ?? 0) + offset);
                } else {
                  if (!ctrl && !event.shiftKey) items.setBibleSelection([]);
                  if (event.shiftKey) {
                    items.setBibleSelection(
                      Array.from(
                        {length: Math.min(anchor.current + 1, texts.length)},
                        (_, index) => index,
                      ),
                    );
                  }
                  items.setCardSelected(true);
                  items.selectPosition(0);
                }
              }}
            >
              <LeadingSlideCardView
                card={card}
                mode={mode}
                style={{position: 'relative'}}
              />
            </div>
          )}
          {texts.map((text, index) => {
            const layer =
              tiles === undefined
                ? null
                : slideLayerOf(
                    {itemId: item.id, index: index + offset},
                    () => tiles,
                  );
            return (
              <div
                key={index}
                className={styles.row}
                data-selected={selected.includes(index)}
                data-song-slide={String(index)}
                role="option"
                aria-selected={selected.includes(index)}
                onClick={event => {
                  const ctrl = event.ctrlKey || event.metaKey;
                  if (
                    (ctrl || event.shiftKey) &&
                    offset > 0 &&
                    position === 0
                  ) {
                    items.setCardSelected(true);
                  }
                  let next: number[];
                  if (event.shiftKey) {
                    const previous = Math.min(anchor.current, texts.length - 1);
                    const start = Math.min(previous, index);
                    const end = Math.max(previous, index);
                    const range = Array.from(
                      {length: end - start + 1},
                      (_, i) => start + i,
                    );
                    next = ctrl ? [...new Set([...selected, ...range])] : range;
                  } else {
                    anchor.current = index;
                    next = ctrl
                      ? selected.includes(index)
                        ? selected.filter(entry => entry !== index)
                        : [...selected, index]
                      : [index];
                  }
                  if (!ctrl && !event.shiftKey) items.setCardSelected(false);
                  items.setBibleSelection(next.length === 0 ? [index] : next);
                  items.selectPosition(index + offset);
                }}
              >
                <div className={styles.thumbnail}>
                  <div className={styles.canvas}>
                    {layer === null || theme === undefined ? null : (
                      <SlidePicture output {...theme} slide={layer} />
                    )}
                  </div>
                  <SlideThumbnailBand number={index + 1 + offset} />
                </div>
                <TextArea
                  className={styles.verse}
                  value={text}
                  onChange={() => undefined}
                  rows={4}
                  readOnly
                  aria-label={`${index + 1}번 예식문`}
                />
              </div>
            );
          })}
        </div>
      </div>
      <PanelFooter
        count={texts.length + offset}
        end={<SlideSurfaceView ui={ui} />}
      />
    </section>
  );
}
