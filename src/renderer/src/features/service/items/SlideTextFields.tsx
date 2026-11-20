import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import {cacheKey} from '@core/bible/split/splitCache';
import {pinVerseParts} from '@core/bible/split/splitVerses';
import {sameBibleVerse} from '@core/bible/selection';
import {emptyLayers} from '@core/live/state';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {
  editedSlideText,
  textSlideKey,
  textVerseKey,
} from '@core/presentation/textOverrides';
import {pinnedBibleVersesSchema} from '@core/schema/biblePassage';
import {parsePayload} from '@core/schema/payload';
import {isItemOfKind} from '@core/schema/service';
import {itemTextOverridesSchema} from '@core/schema/slideTextOverrides';
import {withSectionCard} from '@core/services/sectionCards';
import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';
import {isThemeTextElement, themeElementText} from '@core/themes/content';
import {resolveThemeOutput} from '@core/themes/output';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import {
  manualThemeText,
  themeTextSlot,
  withSlideTextOverrides,
} from '@core/themes/textSlots';
import {TYPING_PAUSE_MS} from '@core/songs/songHistory';
import {timerText} from '@core/timers/timerClock';
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {themeElementNames} from '@renderer/rendering/themeNames';
import {STAGE_TICK_MS, stageClockText} from '@renderer/rendering/stageClock';
import {useLive} from '@renderer/session/live';
import {useShow} from '@renderer/session/show';
import {TextArea} from '@renderer/ui/TextArea';
import type {ServiceItemState, ServiceItemStore} from './serviceItemStore';
import styles from './SlideTextFields.module.css';

const readTime = () => ({
  wall: Date.now(),
  timer: performance.timeOrigin + performance.now(),
});

function TextSlot({
  name,
  value,
  save,
}: {
  readonly name: string;
  readonly value: string;
  readonly save: (text: string) => Promise<boolean>;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const flush = (): void => {
    const text = pending.current;
    if (text === null) return;
    pending.current = null;
    editorTask(
      save(text).then(ok => {
        if (ok) setDraft(current => (current === text ? null : current));
        else pending.current ??= text;
      }),
    );
  };
  const flushIdle = useEffectEvent(flush);
  useEffect(() => {
    if (draft === null) return;
    const timer = setTimeout(() => flushIdle(), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => () => flushIdle(), []);
  return (
    <label>
      {name}
      <TextArea
        aria-label={name}
        maxLength={4000}
        value={draft ?? value}
        onChange={text => {
          pending.current = text;
          setDraft(text);
        }}
        onBlur={flush}
      />
    </label>
  );
}

export type RenderSlideTextFields = (position?: number) => ReactNode;

export function SlideTextFields({
  items,
  state,
  position,
}: {
  readonly items: ServiceItemStore;
  readonly state: ServiceItemState;
  readonly position?: number;
}): JSX.Element {
  return (
    <SlideTextEditor items={items} state={state}>
      {renderFields => renderFields(position)}
    </SlideTextEditor>
  );
}

/** Shares the projection and settings across the rows in one editing surface. */
export function SlideTextEditor({
  items,
  state,
  children,
}: {
  readonly items: ServiceItemStore;
  readonly state: ServiceItemState;
  readonly children: (renderFields: RenderSlideTextFields) => ReactNode;
}): JSX.Element {
  const {item, service} = state;
  const id = item?.id ?? null;
  const serviceId = service?.service.id;
  const row = useShow(view =>
    view.serviceId === serviceId
      ? view.rows.find(row => row.id === id)
      : undefined,
  );
  const saved = useShow(view =>
    view.serviceId === serviceId && id !== null ? view.tiles[id] : undefined,
  );
  const projection = useBibleTileProjection({
    itemId: id,
    ...(serviceId === undefined ? {} : {serviceId}),
    anyItem: true,
  });
  const themes = useSettingsDocument(
    id === null ? null : 'themes',
    '테마',
    items.reportNotice,
  );
  const screens = useSettingsDocument(
    id === null ? null : 'screens',
    '화면',
    items.reportNotice,
  );
  const timers = useSettingsDocument(
    id === null ? null : 'timers',
    '타이머',
    items.reportNotice,
  );
  const stageMessage = useLive(view => view.state?.stageMessage);
  const timerRuns = useLive(view => view.state?.timers);
  const stageTimerId = useLive(view => view.state?.stageTimerId);
  const [now, setNow] = useState(readTime);
  useEffect(() => {
    if (id === null) return;
    const timer = setInterval(() => setNow(readTime()), STAGE_TICK_MS);
    return () => clearInterval(timer);
  }, [id]);
  if (
    !item ||
    !serviceId ||
    !row ||
    row.kind === 'header' ||
    row.kind === 'unknown' ||
    !screens
  ) {
    return <>{children(() => null)}</>;
  }
  const tiles =
    projection === null
      ? (saved ?? [])
      : withSectionCard(
          'sectionCard' in item ? item.sectionCard : undefined,
          projection.tiles,
        );
  const renderFields: RenderSlideTextFields = position => {
    const selected = position ?? Math.min(state.position, tiles.length - 1);
    const tile = tiles[selected];
    if (!tile) return null;
    if (
      tile.bibleVerse !== undefined &&
      projection === null &&
      (isItemOfKind(item, 'bible') || isItemOfKind(item, 'sermon'))
    ) {
      return null;
    }
    const key = textSlideKey(tile);
    const slide = slideLayerOf({itemId: item.id, index: selected}, () => tiles);
    if (key === undefined || slide === null) return null;
    const kind = tile.sectionCard
      ? 'blank'
      : row.kind === 'slides'
        ? row.form
        : row.kind;
    const themeId =
      tile.sectionCard?.theme ??
      (tile.sermonTitle ? SERMON_TITLE_THEME_ID : undefined) ??
      item.theme ??
      (isItemOfKind(item, 'liturgy') ? CREED_PRAYER_THEME_ID : undefined);
    const themeItem = {
      id: item.id,
      kind,
      title: tile.sectionCard === undefined ? row.title : tile.sectionCard.name,
      source: 'service' as const,
      ...(themeId === undefined ? {} : {theme: themeId}),
      ...('memo' in item ? {memo: item.memo} : {}),
    };
    const output = resolveThemeOutput({
      file: themes?.value ?? null,
      screens: screens.value.screens,
      item: themeItem,
      revision: 0,
    });
    const slots = new Map<string, {name: string; text: string}>();
    const layers = {...emptyLayers(), slide};
    for (const layout of Object.values(output.screens)) {
      const binding = {...layout, themeId: output.themeId};
      for (const element of withSlideTextOverrides(binding, slide).elements) {
        if (!isThemeTextElement(element)) continue;
        const slot = themeTextSlot(binding, element);
        const timerId =
          element.kind === 'timer'
            ? (element.timerId ?? stageTimerId)
            : undefined;
        const timer = timers?.value.timers.find(timer => timer.id === timerId);
        const text =
          manualThemeText(element) ??
          themeElementText(element, {
            layers,
            item: themeItem,
            stageMessage,
            clock:
              element.kind === 'clock'
                ? stageClockText(now.wall, element.clockFormat, element.seconds)
                : undefined,
            timer:
              timer === undefined
                ? undefined
                : timerText(timer, timerRuns?.[timer.id], now),
          });
        if (!slots.has(slot) || (slots.get(slot)?.text === '' && text)) {
          slots.set(slot, {
            name:
              'name' in element &&
              typeof element.name === 'string' &&
              element.name.trim()
                ? element.name
                : themeElementNames[element.kind],
            text: text ?? '',
          });
        }
      }
    }
    const save = (slot: string, value: string) =>
      items.submitItemEdit({
        target: {serviceId, itemId: item.id},
        failure: '슬라이드 글 저장 실패',
        change: fresh => {
          if (service.access === 'readOnly') return null;
          const textOverrides = editedSlideText(fresh.textOverrides, {
            slide: key,
            slot,
            text: value,
          });
          if (!parsePayload(itemTextOverridesSchema, textOverrides).ok) {
            return null;
          }
          if (
            JSON.stringify(textOverrides) ===
            JSON.stringify(fresh.textOverrides ?? {})
          ) {
            return fresh;
          }
          const updated = {...fresh, textOverrides};
          if (
            !tile.bibleVerse ||
            !projection ||
            (!isItemOfKind(updated, 'bible') &&
              !isItemOfKind(updated, 'sermon'))
          ) {
            return updated;
          }
          const reference = tile.bibleVerse;
          const passage = isItemOfKind(updated, 'bible')
            ? updated.bible
            : updated.sermon.passage;
          const original = isItemOfKind(item, 'bible')
            ? item.bible
            : isItemOfKind(item, 'sermon')
              ? item.sermon.passage
              : undefined;
          const verseKey = cacheKey(reference);
          const pinKey = textVerseKey(reference);
          if (
            passage.translation !== reference.translation ||
            passage.ref !== original?.ref ||
            JSON.stringify(passage.cuts?.[verseKey]) !==
              JSON.stringify(original.cuts?.[verseKey])
          ) {
            return null;
          }
          const verse = projection.verses.find(verse =>
            sameBibleVerse(reference, verse.reference),
          );
          const parts =
            verse === undefined
              ? undefined
              : pinVerseParts(
                  verse.text,
                  projection.parts.filter(part =>
                    sameBibleVerse(reference, part.reference),
                  ),
                );
          if (parts === undefined) return null;
          const alreadyPinned = passage.pinnedVerses?.[pinKey];
          if (
            alreadyPinned !== undefined &&
            JSON.stringify(alreadyPinned) !== JSON.stringify(parts)
          ) {
            return null;
          }
          const {[pinKey]: _prior, ...otherPins} = {...passage.pinnedVerses};
          const pinsVerse = Object.keys(textOverrides).some(key =>
            key.startsWith(`verse:${pinKey}:`),
          );
          const pinnedVerses = pinsVerse
            ? {...otherPins, [pinKey]: parts}
            : otherPins;
          if (!parsePayload(pinnedBibleVersesSchema, pinnedVerses).ok) {
            return null;
          }
          const next = {...passage, pinnedVerses};
          return isItemOfKind(updated, 'bible')
            ? {...updated, bible: next}
            : {...updated, sermon: {...updated.sermon, passage: next}};
        },
      });
    return (
      <fieldset
        className={styles.fields}
        disabled={service.access === 'readOnly'}
        aria-label="슬라이드 글"
      >
        {[...slots].map(([slot, {name, text}]) => (
          <TextSlot
            key={JSON.stringify([item.id, key, slot])}
            name={name}
            value={item.textOverrides?.[key]?.[slot] ?? text}
            save={text => save(slot, text)}
          />
        ))}
      </fieldset>
    );
  };
  return <>{children(renderFields)}</>;
}
