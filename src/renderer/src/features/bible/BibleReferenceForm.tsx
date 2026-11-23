import {
  LIVE_BIBLE_ID,
  exactBibleBook,
  findBibleBooks,
  parseReference,
  changeReferenceField,
  EMPTY_REFERENCE,
  reconcileReferenceFields,
  referenceFieldsState,
  selectedBook,
  type ReferencePart,
} from '@core/bible';
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
import type {RecentPassage} from '@core/schema/bible';
import {
  BIBLE_LOOKUP_LIMITS,
  type BibleLookupPassage,
} from '@core/schema/bibleLookup';
import type {TranslationId} from '@core/schema/ids';
import {TextField} from '@renderer/ui';
import {isComposing} from '@renderer/ui/ime';
import {BibleSuggestions, type BibleSuggestion} from './BibleSuggestions';
import {
  LIVE_BOUNDS,
  NUMBER_PARTS,
  REFERENCE_LABELS,
  fieldsOfReference,
  focusPart,
  fullReferenceCandidate,
  numberPlaceholder,
  readReferenceFields,
  referenceKey,
  referenceSuggestions,
} from './referenceForm';
import {
  runReferenceKey,
  type ReferenceKeyHandlers,
} from './referenceKeyActions';
import {useBibleLookup} from './useBibleLookup';
import styles from './BibleReferenceField.module.css';

export interface BibleReferenceFormProps {
  readonly submitRef?: Ref<{submit: () => void}> | undefined;
  readonly submissionDisabled?: boolean | undefined;
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

const ignorePreview = (): void => undefined;

/** Shares book completion and endpoint validation across Show and Prep. */
export function BibleReferenceForm(
  props: BibleReferenceFormProps,
): JSX.Element {
  const [fields, setFields] = useState(() =>
    fieldsOfReference(props.initialRef),
  );
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
  /** Counts the books chosen with a move on to 장. */
  const [toChapter, setToChapter] = useState(0);
  useLayoutEffect(() => {
    if (toChapter === 0) return;
    // NOTE(0913vision): Completion must enable the chapter input before focus.
    focusPart(root.current, 'chapter');
  }, [toChapter]);
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
  const reconciled = reconcileReferenceFields(fields, metadataBounds);
  if (reconciled !== fields) setFields(reconciled);
  const state = referenceFieldsState(reconciled, metadataBounds);
  const fullReference = fullReferenceCandidate(reconciled.book);
  const chapterOnly =
    fields.start === '' &&
    state.errors.chapter === undefined &&
    book !== undefined &&
    translation !== undefined;
  const hasSubmitCandidate =
    chapterOnly || (fullReference !== null && fullReference.input !== '');
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
  const suggestions = referenceSuggestions(
    books,
    props.recents ?? [],
    props.translation,
  );
  const expanded =
    props.translation !== undefined && open && suggestions.length > 0;
  const change = (part: ReferencePart, value: string): void => {
    const nextFields = reconcileReferenceFields(
      changeReferenceField(fields, part, value),
      metadataBounds,
    );
    if (nextFields === fields && value !== fields[part]) return;
    pendingSubmit.current = null;
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
    if (item.ref === undefined || item.translation === undefined) {
      choose(item.input);
      // NOTE(0913vision): A chosen book moves on to 장, as in copible, the
      // Bible reference app.
      if (advance && item.bookId !== undefined) setToChapter(turn => turn + 1);
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
        ? '입력한 이름과 일치하는 성경 책이 없습니다.'
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
    setToChapter(turn => turn + 1);
  };
  const acceptFullReference = (value: string, submit: boolean): boolean => {
    const candidate = fullReferenceCandidate(value);
    if (candidate === null) return false;
    const {reference, next, parsedState, input, invalidPart} = candidate;
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
  const clear = (): void => {
    props.onIntent?.();
    setFields(EMPTY_REFERENCE);
    setRecent(null);
    setOpen(false);
    setBlocked(null);
    focusPart(root.current, 'book');
  };
  const keyHandlers: ReferenceKeyHandlers = {
    tabAfterComposition: () => {
      tabAfterComposition.current = true;
    },
    focus: part => focusPart(root.current, part),
    point: index => {
      setOpen(true);
      setPointed(index);
      setKeyboardPointed(index);
    },
    advanceBook: () => advanceBook(),
    block: part => setBlocked(part),
    clear: () => clear(),
    escape: () => props.onEscape?.(),
    closeSuggestions: () => setOpen(false),
    toBook: () => {
      setBlocked(null);
      root.current
        ?.querySelector<HTMLInputElement>('[role="combobox"]')
        ?.focus();
    },
    chooseHighlighted: () => {
      const highlighted = suggestions[keyboardPointed ?? -1];
      if (highlighted !== undefined) chooseSuggestion(highlighted);
    },
    fullReference: (value, submitNow) => {
      acceptFullReference(value, submitNow);
    },
    submit: part => submit(part),
    forgetSubmit: () => {
      pendingSubmit.current = null;
    },
  };
  const onKeyDown = (
    part: ReferencePart,
    event: KeyboardEvent<HTMLInputElement>,
  ): void => {
    const highlighted = suggestions[keyboardPointed ?? -1];
    runReferenceKey(
      {
        part,
        event,
        action: referenceKey(
          part,
          {
            key: event.key,
            code: event.nativeEvent.code,
            shift: event.shiftKey,
            command: event.altKey || event.ctrlKey || event.metaKey,
            repeat: event.repeat,
            composing: isComposing(event),
            value: event.currentTarget.value,
          },
          {
            dialogMode: props.dialogMode === true,
            expanded,
            escapes: props.onEscape !== undefined,
            submissionDisabled: props.submissionDisabled === true,
            highlightedBook: highlighted?.bookId !== undefined,
            highlighted: highlighted !== undefined,
            pointed,
            suggestions: suggestions.length,
            fields,
            enabled: state.enabled,
            error: state.errors[part] !== undefined,
          },
        ),
      },
      keyHandlers,
    );
  };
  const submit = (part: ReferencePart): void => {
    if (props.translation === undefined || props.submissionDisabled) return;
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
      if (props.submissionDisabled) return;
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
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onCompositionStart={() => {
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
            affix={props.overlayLabels ? REFERENCE_LABELS[part] : undefined}
            inputMode="numeric"
            aria-label={REFERENCE_LABELS[part]}
            placeholder={numberPlaceholder(part, {
              dialogMode: props.dialogMode === true,
              overlayLabels: props.overlayLabels === true,
              chapters: metadataBook?.chapters,
              chapter: chapterNumber,
              lastVerse,
              start: fields.start,
            })}
            data-reference-part={part}
            maxLength={BIBLE_LOOKUP_LIMITS.input}
            value={fields[part]}
            onChange={value => change(part, value)}
            onKeyDown={event => onKeyDown(part, event)}
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
