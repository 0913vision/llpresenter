import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {BIBLE_VERSE_COUNTS} from '@core/bible/bibleVerseCounts';
import {LIVE_BIBLE_ID} from '@core/bible/liveTranslation';
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useImperativeHandle,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type Ref,
} from 'react';
import type {BibleLookupApi} from '@contracts/ipc/bible';
import {exactBibleBook, findBibleBooks} from '@core/bible/bibleMatching';
import {parseReference} from '@core/bible/reference';
import {recentPassages} from '@core/bible/bibleRecents';
import type {RecentPassage} from '@core/schema/bible';
import {
  BIBLE_LOOKUP_LIMITS,
  type BibleLookupPassage,
} from '@core/schema/bibleLookup';
import type {TranslationId} from '@core/schema/ids';
import {TextField} from '@renderer/ui';
import {isComposing} from '@renderer/ui/ime';
import {BibleSuggestions, type BibleSuggestion} from './BibleSuggestions';
import {useBibleLookup} from './useBibleLookup';
import {
  changeReferenceField,
  EMPTY_REFERENCE,
  reconcileReferenceFields,
  referenceFieldsState,
  selectedBook,
  type ReferenceFields,
  type ReferencePart,
} from '@core/bible/referenceFields';
import styles from './BibleReferenceField.module.css';

export interface BibleReferenceFormProps {
  readonly submitRef?: Ref<{submit: () => void}> | undefined;
  readonly initialRef?: string | undefined;
  readonly dialogMode?: boolean;
  readonly onEffectiveTranslation?: ((id: TranslationId) => void) | undefined;
  readonly overlayLabels?: boolean;
  readonly api: BibleLookupApi;
  readonly translation: TranslationId | undefined;
  readonly onPreview: (passage: BibleLookupPassage) => void;
  readonly onSubmit: (passage: BibleLookupPassage) => void;
  readonly onIntent?: (() => void) | undefined;
  readonly onEdit?:
    ((equivalent: BibleLookupPassage | null) => void) | undefined;
  readonly autoFocus?: boolean;
  /** Submit from any field in quick run instead of advancing on Enter. */
  readonly recents?: readonly RecentPassage[];
  readonly onReady?: (passage: BibleLookupPassage | null) => void;
  readonly onSubmitCandidate?: ((valid: boolean) => void) | undefined;
  /** In a dialog, Esc dismisses the form after closing book suggestions. */
  readonly onEscape?: (() => void) | undefined;
}

const NUMBER_PARTS = ['chapter', 'start', 'end'] as const;
const LABELS = {
  book: '책',
  chapter: '장',
  start: '시작절',
  end: '끝절',
} as const;
const ignorePreview = (): void => undefined;
const LIVE_BOUNDS = new Map(
  BIBLE_BOOKS.map(book => [
    book.id,
    {bookId: book.id, chapterVerses: BIBLE_VERSE_COUNTS[book.id - 1] ?? []},
  ]),
);

function focusPart(root: HTMLElement | null, part: ReferencePart): void {
  const field = root?.querySelector<HTMLInputElement>(
    `[data-reference-part="${part}"]`,
  );
  field?.focus();
  field?.select();
}

function readReferenceFields(
  root: HTMLElement | null,
  fallback: ReferenceFields,
): ReferenceFields {
  const current = {...fallback};
  for (const part of ['book', ...NUMBER_PARTS] as const) {
    const field = root?.querySelector<HTMLInputElement>(
      `[data-reference-part="${part}"]`,
    );
    if (field !== undefined && field !== null) current[part] = field.value;
  }
  return current;
}

/** Shares book completion and endpoint validation across Show and Prep. */
export function BibleReferenceForm(
  props: BibleReferenceFormProps,
): JSX.Element {
  const [fields, setFields] = useState(() => {
    const parsed =
      props.initialRef === undefined ? null : parseReference(props.initialRef);
    if (!parsed?.ok) return EMPTY_REFERENCE;
    const value = parsed.value;
    return {
      book: value.book.korean,
      chapter: String(value.chapter),
      start: value.verse === null ? '' : String(value.verse),
      end:
        value.endVerse === null || value.endVerse === value.verse
          ? ''
          : String(value.endVerse),
    };
  });
  const [open, setOpen] = useState(false);
  const [pointed, setPointed] = useState(-1);
  const [keyboardPointed, setKeyboardPointed] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<ReferencePart | null>(null);
  // NOTE(0913vision): Korean input still composes "합" when Tab is pressed, so
  // the book is completed after the IME commits, as with a plain Tab.
  const tabAfterComposition = useRef(false);
  const [recent, setRecent] = useState<{
    readonly provided: TranslationId | undefined;
    readonly value: RecentPassage;
  } | null>(null);
  if (recent && recent.provided !== props.translation) {
    setRecent({
      provided: props.translation,
      value: {
        ...recent.value,
        translation: props.translation ?? recent.value.translation,
      },
    });
  }
  const selectedRecent = recent?.value;
  const translation =
    recent?.provided === props.translation && props.translation !== undefined
      ? (selectedRecent?.translation ?? props.translation)
      : props.translation;
  const root = useRef<HTMLDivElement>(null);
  const [chapterFocus, setChapterFocus] = useState<{
    readonly bookId: number;
    readonly translation: TranslationId | undefined;
  } | null>(null);
  const advancedBook = useRef<typeof chapterFocus>(null);
  useLayoutEffect(() => {
    if (chapterFocus === null) return;
    // NOTE(0913vision): Completion must enable the chapter input before focus.
    focusPart(root.current, 'chapter');
    advancedBook.current = chapterFocus;
  }, [chapterFocus]);
  useEffect(() => {
    if (props.autoFocus && props.translation !== undefined) {
      root.current
        ?.querySelector<HTMLInputElement>('[role="combobox"]')
        ?.focus();
    }
  }, [props.autoFocus, props.translation]);
  const bookAnchor = useRef<HTMLDivElement>(null);
  const listId = useId();
  const book = selectedBook(fields.book);
  const bookId = book?.id;
  const books = findBibleBooks(fields.book);
  const metadataBook =
    exactBibleBook(fields.book) ?? books[keyboardPointed ?? -1] ?? book;
  const metadata = useBibleLookup({
    ...props,
    translation,
    input: metadataBook?.korean ?? '',
    onPreview: ignorePreview,
  });
  const metadataBounds =
    metadataBook === undefined ? undefined : LIVE_BOUNDS.get(metadataBook.id);
  useEffect(() => {
    const target = advancedBook.current;
    if (target === null) return;
    if (target.bookId !== bookId || target.translation !== translation) {
      advancedBook.current = null;
      return;
    }
    advancedBook.current = null;
  }, [bookId, chapterFocus, translation]);
  const reconciled = reconcileReferenceFields(fields, metadataBounds);
  if (reconciled !== fields) setFields(reconciled);
  const state = referenceFieldsState(reconciled, metadataBounds);
  const fullReference = parseReference(reconciled.book);
  const chapterOnly =
    fields.start === '' &&
    state.errors.chapter === undefined &&
    book !== undefined &&
    translation !== undefined;
  const hasSubmitCandidate =
    chapterOnly ||
    (fullReference.ok &&
      fullReference.value.chapter === fullReference.value.endChapter);
  const onSubmitCandidate = props.onSubmitCandidate;
  useEffect(
    () => onSubmitCandidate?.(hasSubmitCandidate),
    [onSubmitCandidate, hasSubmitCandidate],
  );
  const chapterNumber = /^\d+$/u.test(reconciled.chapter)
    ? Number(reconciled.chapter)
    : 0;
  const lastVerse = metadataBounds?.chapterVerses[chapterNumber - 1];
  const reply = useBibleLookup({
    ...props,
    translation,
    input: selectedRecent?.ref ?? state.input,
  });
  const passage = reply?.result.ok ? reply.result.value : undefined;
  const effective = passage?.translation ?? metadata?.effectiveTranslation;
  const onEffectiveTranslation = props.onEffectiveTranslation;
  useEffect(() => {
    if (effective) onEffectiveTranslation?.(effective);
  }, [effective, onEffectiveTranslation]);
  const liveTranslation =
    (passage?.translation ?? metadata?.effectiveTranslation) === LIVE_BIBLE_ID;
  const pendingSubmit = useRef<{
    input: string;
    translation: TranslationId;
    clampedEnd: number | undefined;
    part: ReferencePart;
  } | null>(null);
  const submitPending = useEffectEvent((value: BibleLookupPassage) => {
    props.onSubmit(value);
  });
  useEffect(() => {
    const pending = pendingSubmit.current;
    if (pending === null) return;
    if (
      pending.input !== (selectedRecent?.ref ?? state.input) ||
      pending.translation !== translation
    ) {
      pendingSubmit.current = null;
      return;
    }
    if (reply === null) return;
    pendingSubmit.current = null;
    if (!reply.result.ok) {
      setBlocked(pending.part);
      return;
    }
    if (pending.clampedEnd !== undefined) {
      setFields(previous => ({...previous, end: String(pending.clampedEnd)}));
    }
    setOpen(false);
    submitPending(reply.result.value);
  }, [reply, selectedRecent?.ref, state.input, translation]);
  const onReady = props.onReady;
  useEffect(() => onReady?.(passage ?? null), [onReady, passage]);
  const suggestions: readonly BibleSuggestion[] = [
    ...books.map(candidate => ({
      key: `book:${candidate.id}`,
      bookId: candidate.id,
      group: '책',
      input: candidate.korean,
      translation: props.translation,
    })),
    ...recentPassages(props.recents ?? []).map(item => ({
      key: `recent:${item.translation}:${item.ref}`,
      group: '최근',
      input: item.ref,
      ref: item.ref,
      translation: item.translation,
    })),
  ];
  const expanded =
    props.translation !== undefined && open && suggestions.length > 0;
  const change = (part: ReferencePart, value: string): void => {
    const nextFields = reconcileReferenceFields(
      changeReferenceField(fields, part, value),
      metadataBounds,
    );
    if (nextFields === fields && value !== fields[part]) return;
    pendingSubmit.current = null;
    advancedBook.current = null;
    props.onIntent?.();
    if (nextFields !== fields || selectedRecent !== undefined) {
      const nextInput = referenceFieldsState(nextFields, metadataBounds).input;
      props.onEdit?.(
        nextInput !== '' && nextInput === (selectedRecent?.ref ?? state.input)
          ? (passage ?? null)
          : null,
      );
    }
    setRecent(null);
    setFields(nextFields);
    setBlocked(null);
    if (part === 'book') {
      setPointed(-1);
      setKeyboardPointed(null);
      setOpen(true);
    }
  };
  const choose = (name: string): void => {
    change('book', name);
    setOpen(false);
  };
  const chooseSuggestion = (item: BibleSuggestion, advance = true): void => {
    advancedBook.current = null;
    if (item.ref === undefined || item.translation === undefined) {
      choose(item.input);
      // NOTE(0913vision): A chosen book moves on to 장, as in copible, the
      // Bible reference app.
      if (advance && item.bookId !== undefined) {
        setChapterFocus({bookId: item.bookId, translation});
      }
      return;
    }
    props.onIntent?.();
    props.onEdit?.(
      reply?.input === item.ref && reply.translation === item.translation
        ? (passage ?? null)
        : null,
    );
    setFields(EMPTY_REFERENCE);
    setBlocked(null);
    setRecent({
      provided: props.translation,
      value: {ref: item.ref, translation: item.translation},
    });
    setPointed(-1);
    setOpen(false);
  };
  const reason = (part: ReferencePart): string | undefined => {
    if (part === 'book') {
      return fields.book.trim() !== '' &&
        books.length === 0 &&
        !parseReference(fields.book).ok
        ? '입력한 이름과 일치하는 성경 책이 없습니다'
        : undefined;
    }
    if (part === 'start' && reply?.result.ok === false) {
      return reply.result.error.code === 'omitted'
        ? '이 역본에 없는 절'
        : '구절 불러오기 실패';
    }
    return fields[part] !== '' || blocked === part
      ? state.errors[part]
      : undefined;
  };
  const advanceBook = (): void => {
    const candidate = metadataBook;
    if (!candidate) {
      setBlocked('book');
      return;
    }
    choose(candidate.korean);
    setChapterFocus({bookId: candidate.id, translation});
  };
  const acceptFullReference = (value: string, submit: boolean): boolean => {
    const parsed = parseReference(value);
    if (!parsed.ok || parsed.value.chapter !== parsed.value.endChapter) {
      return false;
    }
    const reference = parsed.value;
    const bounds = LIVE_BOUNDS.get(reference.book.id);
    const last = bounds?.chapterVerses[reference.chapter - 1];
    const next: ReferenceFields = {
      book: reference.book.korean,
      chapter: String(reference.chapter),
      start: String(reference.verse ?? 1),
      end: String(reference.endVerse ?? last ?? 1),
    };
    const parsedState = referenceFieldsState(next, bounds);
    const input =
      reference.verse === null && parsedState.input
        ? `${reference.book.korean} ${reference.chapter}`
        : parsedState.input;
    const invalidPart: ReferencePart = parsedState.errors.chapter
      ? 'chapter'
      : parsedState.errors.start
        ? 'start'
        : 'end';
    props.onIntent?.();
    props.onEdit?.(null);
    setRecent(
      reference.verse === null && input && translation !== undefined
        ? {provided: props.translation, value: {ref: input, translation}}
        : null,
    );
    setFields(next);
    setOpen(false);
    setBlocked(input ? null : invalidPart);
    if (submit && input && translation !== undefined) {
      pendingSubmit.current = {
        input,
        translation,
        clampedEnd: parsedState.clampedEnd,
        part: 'end',
      };
    } else {
      pendingSubmit.current = null;
      queueMicrotask(() =>
        focusPart(root.current, input ? 'end' : invalidPart),
      );
    }
    return true;
  };
  const onKeyDown = (
    part: ReferencePart,
    event: KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (isComposing(event)) {
      if (
        part === 'book' &&
        !event.shiftKey &&
        (event.key === 'Tab' || event.nativeEvent.code === 'Tab')
      ) {
        event.preventDefault();
        tabAfterComposition.current = true;
      }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (props.dialogMode && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      pendingSubmit.current = null;
      if (
        [fields.book, fields.chapter, fields.start, fields.end].some(
          value => value !== '',
        )
      ) {
        props.onIntent?.();
        setFields(EMPTY_REFERENCE);
        setRecent(null);
        setOpen(false);
        setBlocked(null);
        focusPart(root.current, 'book');
      } else props.onEscape?.();
      return;
    }
    if (
      props.dialogMode &&
      event.key === 'Backspace' &&
      event.currentTarget.value === '' &&
      part !== 'book'
    ) {
      event.preventDefault();
      const index = NUMBER_PARTS.indexOf(part);
      focusPart(
        root.current,
        index <= 0 ? 'book' : (NUMBER_PARTS[index - 1] ?? 'book'),
      );
      return;
    }
    if (event.key === 'Escape' && expanded) {
      pendingSubmit.current = null;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === 'Escape' && props.onEscape !== undefined) {
      pendingSubmit.current = null;
      event.preventDefault();
      event.stopPropagation();
      props.onEscape();
      return;
    }
    if (part === 'book') {
      const highlighted = suggestions[keyboardPointed ?? -1];
      if (
        expanded &&
        !event.repeat &&
        (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) &&
        highlighted?.bookId !== undefined
      ) {
        event.preventDefault();
        event.stopPropagation();
        chooseSuggestion(highlighted);
        return;
      }
      if (
        (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) &&
        !event.repeat &&
        acceptFullReference(event.currentTarget.value, event.key === 'Enter')
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        advancedBook.current = null;
        event.preventDefault();
        setOpen(true);
        const next =
          event.key === 'ArrowDown'
            ? Math.min(pointed + 1, suggestions.length - 1)
            : Math.max(-1, pointed - 1);
        setPointed(next);
        setKeyboardPointed(next);
        return;
      }
      if (event.key === 'Tab' && !event.shiftKey) {
        if (
          fields.book.trim() === '' &&
          suggestions[keyboardPointed ?? -1] === undefined
        ) {
          return;
        }
        event.preventDefault();
        advanceBook();
        return;
      }
    }
    if (event.key === 'Escape' && part !== 'book') {
      pendingSubmit.current = null;
      event.preventDefault();
      event.stopPropagation();
      setBlocked(null);
      root.current
        ?.querySelector<HTMLInputElement>('[role="combobox"]')
        ?.focus();
      return;
    }
    if (
      (part === 'chapter' && event.key === ':' && state.enabled.start) ||
      (part === 'start' && /^[-~\uFF5E]$/u.test(event.key) && state.enabled.end)
    ) {
      event.preventDefault();
      focusPart(root.current, part === 'chapter' ? 'start' : 'end');
      return;
    }
    if (part !== 'book' && event.key.length === 1 && !/^\d$/u.test(event.key)) {
      event.preventDefault();
      return;
    }
    if (
      event.key === 'Tab' &&
      !event.shiftKey &&
      state.errors[part] &&
      [fields.book, fields.chapter, fields.start, fields.end].some(
        value => value.trim() !== '',
      )
    ) {
      event.preventDefault();
      setBlocked(part);
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    submit(part);
  };
  const submit = (part: ReferencePart): void => {
    if (props.translation === undefined) return;
    if (chapterOnly) {
      const input = `${book.korean} ${fields.chapter}`;
      setRecent({
        provided: props.translation,
        value: {ref: input, translation},
      });
      pendingSubmit.current = {input, translation, clampedEnd: undefined, part};
      return;
    }
    // NOTE(0913vision): The last change can still be batched while the lookup
    // and its rendered result refer to the previous value.
    const currentFields = readReferenceFields(root.current, fields);
    const currentState = referenceFieldsState(currentFields, metadataBounds);
    const input = selectedRecent?.ref ?? currentState.input;
    if (passage && reply?.input === input) {
      pendingSubmit.current = null;
      if (currentFields.end !== '' && currentState.clampedEnd !== undefined) {
        setFields(previous => ({
          ...previous,
          end: String(currentState.clampedEnd),
        }));
      }
      setOpen(false);
      props.onSubmit(passage);
    } else if (
      translation !== undefined &&
      input !== '' &&
      reply?.input !== input
    ) {
      pendingSubmit.current = {
        input,
        translation,
        clampedEnd:
          currentFields.end === '' ? undefined : currentState.clampedEnd,
        part,
      };
    } else {
      setBlocked(part);
    }
  };
  useImperativeHandle(props.submitRef, () => ({
    submit: () => {
      const bookValue = readReferenceFields(root.current, fields).book;
      if (!acceptFullReference(bookValue, true)) submit('book');
    },
  }));

  return (
    <div
      ref={root}
      className={
        props.dialogMode ? `${styles.form} ${styles.dialogForm}` : styles.form
      }
      role="group"
      aria-label="성경 구절"
      onBlur={event => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          pendingSubmit.current = null;
        }
      }}
    >
      <div ref={bookAnchor} className={styles.book}>
        <TextField
          size={props.overlayLabels ? 'md' : 'sm'}
          block
          icon="book"
          affix={props.overlayLabels ? '책' : undefined}
          clearable={!props.dialogMode}
          autoFocus={props.autoFocus}
          aria-label="책"
          data-reference-part="book"
          placeholder={props.overlayLabels ? '' : '책'}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={
            expanded && pointed >= 0 ? `${listId}-${pointed}` : undefined
          }
          maxLength={BIBLE_LOOKUP_LIMITS.input}
          value={fields.book}
          onChange={value => change('book', value)}
          onKeyDown={event => onKeyDown('book', event)}
          onFocus={() => {
            advancedBook.current = null;
            setOpen(true);
          }}
          onBlur={() => {
            advancedBook.current = null;
            setOpen(false);
          }}
          onCompositionStart={() => {
            advancedBook.current = null;
            tabAfterComposition.current = false;
          }}
          onCompositionEnd={() => {
            if (!tabAfterComposition.current) return;
            tabAfterComposition.current = false;
            advanceBook();
          }}
          disabled={props.translation === undefined}
          invalid={reason('book') !== undefined}
          invalidReason={reason('book')}
        />
      </div>
      {NUMBER_PARTS.map(part => (
        <span
          key={part}
          className={props.dialogMode ? styles.argument : undefined}
          data-part={part}
        >
          <TextField
            size={props.overlayLabels ? 'md' : 'sm'}
            block
            affix={props.overlayLabels ? LABELS[part] : undefined}
            inputMode="numeric"
            aria-label={LABELS[part]}
            placeholder={
              props.dialogMode
                ? part === 'chapter' && metadataBook
                  ? `1~${metadataBook.chapters}`
                  : part !== 'chapter' && chapterNumber > 0
                    ? lastVerse === undefined
                      ? '불러오는 중...'
                      : `${part === 'end' && fields.start ? fields.start : 1}~${lastVerse}`
                    : LABELS[part]
                : part === 'end' && lastVerse !== undefined
                  ? String(lastVerse)
                  : props.overlayLabels
                    ? ''
                    : LABELS[part]
            }
            data-reference-part={part}
            maxLength={BIBLE_LOOKUP_LIMITS.input}
            value={fields[part]}
            onChange={value => change(part, value)}
            onKeyDown={event => onKeyDown(part, event)}
            onBlur={() => {
              advancedBook.current = null;
            }}
            onCompositionStart={() => {
              advancedBook.current = null;
            }}
            disabled={props.translation === undefined || !state.enabled[part]}
            invalid={reason(part) !== undefined}
            invalidReason={reason(part)}
          />
        </span>
      ))}
      {!props.dialogMode &&
      (props.overlayLabels ||
        props.onEscape !== undefined ||
        liveTranslation) ? (
        <span
          className={styles.translation}
          role={liveTranslation ? 'status' : undefined}
        >
          {liveTranslation ? '개역개정 (실시간)' : null}
        </span>
      ) : null}
      {expanded ? (
        <BibleSuggestions
          id={listId}
          anchor={bookAnchor}
          items={suggestions}
          pointed={pointed}
          onPoint={index => {
            setPointed(index);
            setKeyboardPointed(null);
          }}
          onChoose={chooseSuggestion}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
