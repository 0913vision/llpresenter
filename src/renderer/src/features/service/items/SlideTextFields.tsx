import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import {normalizeVerse} from '@core/bible/split/manualSplit';
import {cacheKey} from '@core/bible/split/splitCache';
import {
  pinVerseParts,
  validatedPinnedVerse,
} from '@core/bible/split/splitVerses';
import {sameBibleVerse} from '@core/bible/selection';
import {displayReference} from '@core/bible/displayReference';
import {emptyLayers} from '@core/live/state';
import {mediaTextSlide, slideLayerOf} from '@core/presentation/slideLayer';
import {
  editedSlideText,
  slideTextValue,
  textSlideKey,
  textVerseKey,
} from '@core/presentation/textOverrides';
import {pinnedBibleVersesSchema} from '@core/schema/biblePassage';
import {parsePayload} from '@core/schema/payload';
import {isItemOfKind} from '@core/schema/service';
import {
  itemTextOverridesSchema,
  type ManualSlideText,
} from '@core/schema/slideTextOverrides';
import type {ThemeTextRole} from '@core/schema/themeTextSlot';
import {withSectionCard} from '@core/services/sectionCards';
import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';
import {
  isSlideEditableElement,
  isThemeTextElement,
  themeElementText,
} from '@core/themes/content';
import {resolveThemeOutput} from '@core/themes/output';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import {isSlideEditableTextValue, matchSlideText} from '@core/themes/textSlots';
import {
  legacyTextBinding,
  themeTextBinding,
  type TextSlotLayout,
} from '@core/themes/textBindings';
import type {ThemeElement} from '@core/schema/themes';
import {TYPING_PAUSE_MS} from '@core/songs/songHistory';
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {RenderSlideTextFields} from '@renderer/features/songs/editor/SlideCardRenderer';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {
  NEWER_FILE_REASON,
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {themeElementNames} from '@renderer/rendering/themeNames';
import {useShow} from '@renderer/session/show';
import {TextArea} from '@renderer/ui/TextArea';
import {Button} from '@renderer/ui/Button';
import type {ServiceItemState, ServiceItemStore} from './serviceItemStore';
import styles from './SlideTextFields.module.css';

interface EditorSlot {
  readonly binding: Omit<ManualSlideText, 'text'>;
  readonly layout: TextSlotLayout;
  readonly element: Extract<ThemeElement, {readonly text: unknown}>;
  readonly name: string;
  readonly text: string;
}

function TextSlot({
  name,
  role,
  value,
  manual,
  items,
  readOnly,
  save,
}: {
  readonly name: string;
  readonly role: ThemeTextRole;
  readonly value: string;
  readonly manual: boolean;
  readonly items: ServiceItemStore;
  readonly readOnly: boolean;
  readonly save: (text: string | null) => Promise<boolean>;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const fieldId = useId();
  const pending = useRef<string | null>(null);
  const saving = useRef<Promise<boolean> | null>(null);
  const replaying = useRef(false);
  const flush = (): Promise<boolean> | null => {
    const text = pending.current;
    if (text === null) return saving.current;
    pending.current = null;
    const request = save(text).then(ok => {
      if (saving.current === request) saving.current = null;
      if (ok) setDraft(current => (current === text ? null : current));
      else pending.current ??= text;
      return ok;
    });
    saving.current = request;
    return request;
  };
  const saveDraft = (): void => {
    const request = flush();
    if (request !== null) editorTask(request);
  };
  const flushIdle = useEffectEvent(saveDraft);
  useEffect(() => {
    if (draft === null) return;
    const timer = setTimeout(() => flushIdle(), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => () => flushIdle(), []);

  const ownsHistory = (event: KeyboardEvent): boolean =>
    event.target instanceof Element &&
    event.target
      .closest('[data-slide-text-history]')
      ?.getAttribute('data-slide-text-history') === fieldId;
  const unavailable = (action: 'undo' | 'redo'): string | undefined => {
    if (readOnly) return NEWER_FILE_REASON;
    if (draft !== null) {
      return action === 'undo' ? undefined : NOTHING_TO_REDO;
    }
    if (items.canUndoItemEdit(action)) return undefined;
    return action === 'undo' ? NOTHING_TO_UNDO : NOTHING_TO_REDO;
  };
  const replay = async (action: 'undo' | 'redo'): Promise<void> => {
    if (
      readOnly ||
      replaying.current ||
      (action === 'redo' && draft !== null)
    ) {
      return;
    }
    replaying.current = true;
    try {
      const request = flush();
      if (request === null || (await request)) {
        await items.replayItemEdit(action);
      }
    } finally {
      replaying.current = false;
    }
  };
  useWindowShortcuts([
    {
      id: 'edit.undo',
      context: 'song',
      when: ownsHistory,
      unavailable: () => unavailable('undo'),
      run: () => replay('undo'),
    },
    {
      id: 'edit.redo',
      context: 'song',
      when: ownsHistory,
      unavailable: () => unavailable('redo'),
      run: () => replay('redo'),
    },
  ]);
  return (
    <div data-slide-text-history={fieldId} className={styles.field}>
      <label>
        {name}
        <TextArea
          aria-label={name}
          data-slide-text-role={role}
          maxLength={4000}
          value={draft ?? value}
          onChange={text => {
            pending.current = text;
            setDraft(text);
          }}
          onBlur={saveDraft}
        />
      </label>
      {manual || draft !== null ? (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${name} 자동 값으로 복원`}
          onClick={() => {
            pending.current = null;
            setDraft(null);
            editorTask(save(null));
          }}
        >
          자동 값으로 복원
        </Button>
      ) : value === '' ? (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${name} 빈 값 유지`}
          onClick={() => editorTask(save(''))}
        >
          빈 값 유지
        </Button>
      ) : null}
    </div>
  );
}

export function SlideTextFields({
  items,
  state,
  slide,
}: {
  readonly items: ServiceItemStore;
  readonly state: ServiceItemState;
  readonly slide?: number | string | undefined;
}): JSX.Element {
  return (
    <SlideTextEditor items={items} state={state}>
      {renderFields => renderFields(slide)}
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
  readonly state: ServiceItemState | null;
  readonly children: (renderFields: RenderSlideTextFields) => ReactNode;
}): JSX.Element {
  const item = state?.item;
  const service = state?.service;
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
  if (
    !state ||
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
  const sourcePositions = new Map<string, number[]>();
  tiles.forEach((tile, index) => {
    const sourceId = tile.sourceSlide?.slideId ?? tile.sourceSlideId;
    if (sourceId === undefined) return;
    const positions = sourcePositions.get(sourceId);
    if (positions === undefined) sourcePositions.set(sourceId, [index]);
    else positions.push(index);
  });
  const defaultKind = row.kind === 'slides' ? row.form : row.kind;
  const renderAt = (selected: number, legend?: string): ReactNode => {
    const tile = tiles[selected];
    if (!tile) return null;
    const key = textSlideKey(tile);
    const projectedSlide = slideLayerOf(
      {itemId: item.id, index: selected},
      () => tiles,
    );
    const slide =
      projectedSlide === null || row.kind !== 'media'
        ? projectedSlide
        : mediaTextSlide(projectedSlide);
    if (key === undefined || slide === null) return null;
    const kind = tile.sectionCard ? 'blank' : defaultKind;
    const themeId =
      tile.sectionCard?.theme ??
      (tile.sermonTitle ? SERMON_TITLE_THEME_ID : undefined) ??
      item.theme ??
      (row.kind === 'song' ? row.theme : undefined) ??
      (isItemOfKind(item, 'liturgy') ? CREED_PRAYER_THEME_ID : undefined);
    const themeItem = {
      id: item.id,
      kind,
      title:
        tile.sectionCard?.name ??
        (isItemOfKind(item, 'sermon')
          ? ((tile.sermonTitle ? tile.reference : undefined) ??
            displayReference(item.sermon.passage.ref))
          : row.title),
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
    const slots = new Map<string, EditorSlot>();
    const liveKeys = new Set<string>();
    const layers = {...emptyLayers(), slide};
    for (const layout of Object.values(output.screens)) {
      const binding = {...layout, themeId: output.themeId};
      for (const element of layout.layout.elements) {
        if (!isThemeTextElement(element)) continue;
        const slot = themeTextBinding(binding, element);
        if (!isSlideEditableElement(element)) {
          liveKeys.add(slot.key);
          liveKeys.add(legacyTextBinding(binding, element));
          continue;
        }
        const text = themeElementText(element, {layers, item: themeItem});
        if (
          !slots.has(slot.key) ||
          (slots.get(slot.key)?.text === '' && text)
        ) {
          const name =
            slot.name ??
            ('name' in element &&
            typeof element.name === 'string' &&
            element.name.trim()
              ? element.name.slice(0, 160)
              : themeElementNames[slot.role]);
          slots.set(slot.key, {
            binding: {
              mode: 'manual',
              slotId: slot.slotId,
              role: slot.role,
              name,
              sourceThemeId: output.themeId,
              ...(slot.screenId === undefined ? {} : {screenId: slot.screenId}),
              ...(slot.uniqueRole ? {uniqueRole: true} : {}),
              ...(slot.explicitSlot ? {explicitSlot: true} : {}),
            },
            layout: binding,
            element,
            name,
            text: text ?? '',
          });
        }
      }
    }
    const save = (slot: string, descriptor: EditorSlot, text: string | null) =>
      items.submitItemEdit({
        target: {serviceId, itemId: item.id},
        failure: '슬라이드 글 저장 실패',
        change: fresh => {
          if (service.access === 'readOnly') return null;
          let textOverrides = fresh.textOverrides ?? {};
          let saved = matchSlideText(
            textOverrides[key],
            descriptor.layout,
            descriptor.element,
          );
          while (
            saved !== undefined &&
            (text === null || typeof saved.value === 'string')
          ) {
            textOverrides = editedSlideText(textOverrides, {
              slide: key,
              slot: saved.key,
              value: null,
            });
            saved = matchSlideText(
              textOverrides[key],
              descriptor.layout,
              descriptor.element,
            );
          }
          if (text !== null) {
            textOverrides = editedSlideText(textOverrides, {
              slide: key,
              slot,
              value: {...descriptor.binding, text},
            });
          }
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
          if (descriptor.binding.role === 'reference') return updated;
          const verse = projection?.verses.find(verse =>
            sameBibleVerse(reference, verse.reference),
          );
          const source = row.kind === 'bible' ? row.bible?.passage : undefined;
          const raw =
            verse?.text ??
            (source?.translation === reference.translation
              ? source.verses.find(
                  candidate =>
                    candidate.chapter === reference.chapter &&
                    candidate.verse === reference.verse,
                )?.text
              : undefined);
          if (raw === undefined) return null;
          const alreadyPinned = validatedPinnedVerse(
            raw,
            passage.pinnedVerses?.[pinKey],
          );
          const parts =
            projection === null
              ? (alreadyPinned ?? [normalizeVerse(raw)])
              : pinVerseParts(
                  raw,
                  projection.parts.filter(part =>
                    sameBibleVerse(reference, part.reference),
                  ),
                );
          if (parts === undefined) return null;
          if (
            alreadyPinned !== undefined &&
            JSON.stringify(alreadyPinned) !== JSON.stringify(parts)
          ) {
            return null;
          }
          const {[pinKey]: _prior, ...otherPins} = {...passage.pinnedVerses};
          const belongsToVerse = (slideKey: string): boolean =>
            slideKey.startsWith(`verse:${pinKey}:`);
          const pinsVerse =
            (passage.deletedSlides ?? []).some(belongsToVerse) ||
            Object.entries(textOverrides).some(
              ([slideKey, slots]) =>
                belongsToVerse(slideKey) &&
                Object.entries(slots).some(
                  ([slotKey, value]) =>
                    isSlideEditableTextValue(slotKey, value) &&
                    (typeof value === 'string'
                      ? slotKey !== 'reference'
                      : value.role !== 'reference'),
                ),
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
    const saved = item.textOverrides?.[key];
    const matchedKeys = new Set<string>();
    const fields = [...slots].map(([slot, descriptor]) => {
      const match = matchSlideText(
        saved,
        descriptor.layout,
        descriptor.element,
      );
      if (match !== undefined) matchedKeys.add(match.key);
      const screen = screens.value.screens.find(
        screen => screen.id === descriptor.binding.screenId,
      );
      const peers = [...slots.values()].filter(
        peer => peer.name === descriptor.name,
      );
      const repeat = peers.filter(
        peer => peer.binding.screenId === descriptor.binding.screenId,
      );
      const showScreen =
        descriptor.binding.screenId !== undefined && screen !== undefined;
      const label = `${descriptor.name}${showScreen ? ` (${screen.name})` : ''}${repeat.length > 1 ? ` ${repeat.indexOf(descriptor) + 1}` : ''}`;
      return (
        <TextSlot
          key={JSON.stringify([item.id, key, slot])}
          name={label}
          role={descriptor.binding.role}
          value={slideTextValue(match?.value) ?? descriptor.text}
          manual={match !== undefined}
          items={items}
          readOnly={service.access === 'readOnly'}
          save={text => save(slot, descriptor, text)}
        />
      );
    });
    const retained = Object.entries(saved ?? {}).filter(
      ([slot, value]) =>
        !matchedKeys.has(slot) &&
        !liveKeys.has(slot) &&
        isSlideEditableTextValue(slot, value),
    );
    return (
      <fieldset
        className={styles.fields}
        disabled={service.access === 'readOnly'}
        aria-label="슬라이드 글"
      >
        {legend === undefined ? null : <legend>{legend}</legend>}
        {fields}
        {retained.length === 0 ? null : (
          <details className={styles.retained}>
            <summary>현재 테마에 연결되지 않은 글</summary>
            <ul>
              {retained.map(([id, value]) => (
                <li key={id}>
                  <strong>
                    {typeof value === 'string'
                      ? id
                      : (value.name ?? value.slotId)}
                  </strong>
                  <p>
                    {slideTextValue(value) === ''
                      ? '빈 값'
                      : slideTextValue(value)}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </fieldset>
    );
  };
  const renderFields: RenderSlideTextFields = target => {
    if (typeof target !== 'string') {
      return renderAt(target ?? Math.min(state.position, tiles.length - 1));
    }
    const positions = sourcePositions.get(target) ?? [];
    if (positions.length === 1 && positions[0] !== undefined) {
      return renderAt(positions[0]);
    }
    return positions.map((position, index) => (
      <div key={index}>
        {renderAt(position, `${index + 1} / ${positions.length}`)}
      </div>
    ));
  };
  return <>{children(renderFields)}</>;
}
