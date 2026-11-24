import {LIVE_BIBLE_ID, type ReferencePart} from '@core/bible';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type Ref,
  type RefObject,
} from 'react';
import type {BibleLookupApi} from '@contracts/ipc/bible';
import type {RecentPassage} from '@core/schema/bible';
import {
  BIBLE_LOOKUP_LIMITS,
  type BibleLookupPassage,
} from '@core/schema/bibleLookup';
import type {TranslationId} from '@core/schema/ids';
import {TextField} from '@renderer/ui';
import {BibleSuggestions} from './BibleSuggestions';
import {useReferenceEdits} from './useReferenceEdits';
import {
  NUMBER_PARTS,
  REFERENCE_LABELS,
  fieldReason,
  focusPart,
  numberPlaceholder,
  referenceSuggestions,
} from './referenceForm';
import {focusBook, useReferenceKeyDown} from './useReferenceKeyDown';
import {useBookSuggestions} from './useBookSuggestions';
import {useReferenceEntry} from './useReferenceEntry';
import {
  useReferenceLookups,
  type ReferenceLookups,
} from './useReferenceLookups';
import {useReferenceSubmit} from './useReferenceSubmit';
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
  /** A whole reference typed in the 책 field, looked up before Enter. */
  readonly onAhead?: ((passage: BibleLookupPassage) => void) | undefined;
  /** In a dialog, Esc dismisses the form after closing book suggestions. */
  readonly onEscape?: (() => void) | undefined;
}

/** The 장, 절 or 끝 절 field of a reference. */
function NumberPartField({
  part,
  dialogMode,
  overlayLabels,
  placeholder,
  value,
  disabled,
  reason,
  onChange,
  onKeyDown,
}: {
  readonly part: (typeof NUMBER_PARTS)[number];
  readonly dialogMode: boolean;
  readonly overlayLabels: boolean;
  readonly placeholder: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly reason: string | undefined;
  readonly onChange: (value: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}): JSX.Element {
  return (
    <span className={dialogMode ? styles.argument : undefined} data-part={part}>
      <TextField
        size={overlayLabels ? 'md' : 'sm'}
        block
        affix={overlayLabels ? REFERENCE_LABELS[part] : undefined}
        inputMode="numeric"
        aria-label={REFERENCE_LABELS[part]}
        placeholder={placeholder}
        data-reference-part={part}
        maxLength={BIBLE_LOOKUP_LIMITS.input}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        invalid={reason !== undefined}
        invalidReason={reason}
      />
    </span>
  );
}

/**
 * Moves the caret to 장 once the render that enables it is in.
 *
 * @returns The function that asks for the move.
 */
function useChapterFocus(root: RefObject<HTMLDivElement | null>): () => void {
  const [asked, setAsked] = useState(0);
  useLayoutEffect(() => {
    if (asked > 0) focusPart(root.current, 'chapter');
  }, [root, asked]);
  return () => setAsked(turn => turn + 1);
}

/** Tells the form's owner what it can send, in which translation. */
function useReferenceReports(
  props: BibleReferenceFormProps,
  lookups: ReferenceLookups,
): void {
  const {onSubmitCandidate, onEffectiveTranslation, onReady} = props;
  const {chapterInput, fullReference, effectiveTranslation, passage} = lookups;
  const hasCandidate =
    chapterInput !== null ||
    (fullReference !== null && fullReference.input !== '');
  useEffect(
    () => onSubmitCandidate?.(hasCandidate),
    [onSubmitCandidate, hasCandidate],
  );
  useEffect(() => {
    if (effectiveTranslation) onEffectiveTranslation?.(effectiveTranslation);
  }, [effectiveTranslation, onEffectiveTranslation]);
  useEffect(() => onReady?.(passage ?? null), [onReady, passage]);
}

/** Shares book completion and endpoint validation across Show and Prep. */
export function BibleReferenceForm(
  props: BibleReferenceFormProps,
): JSX.Element {
  const dialogMode = props.dialogMode === true;
  const overlayLabels = props.overlayLabels === true;
  const root = useRef<HTMLDivElement>(null);
  const bookAnchor = useRef<HTMLDivElement>(null);
  const listId = useId();
  const moveToChapter = useChapterFocus(root);
  useEffect(() => {
    if (props.autoFocus && props.translation !== undefined) {
      focusBook(root.current);
    }
  }, [props.autoFocus, props.translation]);

  const entry = useReferenceEntry(props.initialRef, props.translation);
  const suggestions = useBookSuggestions();
  const lookups = useReferenceLookups({
    api: props.api,
    entry,
    keyboardPointed: suggestions.keyboardPointed,
    onPreview: props.onPreview,
    onAhead: props.onAhead,
  });
  useReferenceReports(props, lookups);
  const submitting = useReferenceSubmit({
    root,
    entry,
    lookups,
    suggestions,
    hasTranslation: props.translation !== undefined,
    submissionDisabled: props.submissionDisabled === true,
    submitRef: props.submitRef,
    onSubmit: props.onSubmit,
    onIntent: props.onIntent,
    onEdit: props.onEdit,
  });
  const edits = useReferenceEdits({
    root,
    entry,
    lookups,
    suggestions,
    moveToChapter,
    forgetSubmit: submitting.forget,
    onIntent: props.onIntent,
    onEdit: props.onEdit,
  });

  const items = referenceSuggestions(
    lookups.books,
    props.recents ?? [],
    props.translation,
  );
  const expanded =
    props.translation !== undefined && suggestions.open && items.length > 0;
  // NOTE(0913vision): Korean input still composes "합" when Tab is pressed, so
  // the book is completed after the IME commits, as with a plain Tab.
  const tabAfterComposition = useRef(false);
  const onKeyDown = useReferenceKeyDown({
    root,
    entry,
    lookups,
    suggestions,
    items,
    expanded,
    edits,
    submitting,
    dialogMode,
    submissionDisabled: props.submissionDisabled === true,
    onEscape: props.onEscape,
    onTabWhileComposing: () => {
      tabAfterComposition.current = true;
    },
  });
  const {fields} = entry;
  const reason = (part: ReferencePart): string | undefined =>
    fieldReason(part, {
      fields,
      bookFound: lookups.books.length > 0,
      lookup:
        lookups.reply?.result.ok === false
          ? lookups.reply.result.error
          : undefined,
      blocked: entry.blocked,
      errors: lookups.state.errors,
    });
  const liveTranslation = lookups.effectiveTranslation === LIVE_BIBLE_ID;

  return (
    <div
      ref={root}
      className={
        dialogMode
          ? `${styles.form} ${styles.headerRow} ${styles.dialogForm}`
          : styles.form
      }
      role="group"
      aria-label="성경 구절"
      onBlur={event => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          submitting.forget();
        }
      }}
    >
      <div
        ref={bookAnchor}
        className={
          dialogMode ? `${styles.book} ${styles.headerField}` : styles.book
        }
      >
        <TextField
          size={overlayLabels ? 'md' : 'sm'}
          block
          icon="book"
          affix={overlayLabels ? '책' : undefined}
          clearable={!dialogMode}
          autoFocus={props.autoFocus}
          aria-label="책"
          data-reference-part="book"
          placeholder={overlayLabels ? '' : '책'}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={
            expanded && suggestions.pointed >= 0
              ? `${listId}-${suggestions.pointed}`
              : undefined
          }
          maxLength={BIBLE_LOOKUP_LIMITS.input}
          value={fields.book}
          onChange={value => edits.change('book', value)}
          onKeyDown={event => onKeyDown('book', event)}
          onFocus={suggestions.show}
          onBlur={suggestions.hide}
          onCompositionStart={() => {
            tabAfterComposition.current = false;
          }}
          onCompositionEnd={() => {
            if (!tabAfterComposition.current) return;
            tabAfterComposition.current = false;
            edits.advanceBook();
          }}
          disabled={props.translation === undefined}
          invalid={reason('book') !== undefined}
          invalidReason={reason('book')}
        />
      </div>
      {NUMBER_PARTS.map(part => (
        <NumberPartField
          key={part}
          part={part}
          dialogMode={dialogMode}
          overlayLabels={overlayLabels}
          placeholder={numberPlaceholder(part, {
            dialogMode,
            overlayLabels,
            chapters: lookups.metadataBook?.chapters,
            chapter: lookups.chapterNumber,
            lastVerse: lookups.lastVerse,
            start: fields.start,
          })}
          value={fields[part]}
          disabled={
            props.translation === undefined || !lookups.state.enabled[part]
          }
          reason={reason(part)}
          onChange={value => edits.change(part, value)}
          onKeyDown={event => onKeyDown(part, event)}
        />
      ))}
      {!dialogMode &&
      (overlayLabels || props.onEscape !== undefined || liveTranslation) ? (
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
          items={items}
          pointed={suggestions.pointed}
          onPoint={suggestions.pointByPointer}
          onChoose={edits.chooseSuggestion}
          onClose={suggestions.hide}
        />
      ) : null}
    </div>
  );
}
