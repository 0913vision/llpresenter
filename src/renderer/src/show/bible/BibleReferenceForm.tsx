import {useId, useRef, useState, type JSX, type KeyboardEvent} from 'react';
import type {LlpApi} from '@shared/ipc';
import {findBibleBooks} from '@shared/bibleMatching';
import {
  BIBLE_LOOKUP_LIMITS,
  type BibleLookupPassage,
} from '@shared/schema/bibleLookup';
import type {TranslationId} from '@shared/schema/ids';
import {TextField} from '@renderer/ui';
import {isComposing} from '@renderer/ui/ime';
import {BibleSuggestions, type BibleSuggestion} from './BibleSuggestions';
import {useBibleLookup} from './useBibleLookup';
import {
  changeReferenceField,
  EMPTY_REFERENCE,
  referenceFieldsState,
  selectedBook,
  type ReferencePart,
} from './referenceFields';
import styles from './BibleReferenceField.module.css';

export interface BibleReferenceFormProps {
  readonly api: LlpApi['bible'];
  readonly translation: TranslationId | undefined;
  readonly onPreview: (passage: BibleLookupPassage) => void;
  readonly onSubmit: (passage: BibleLookupPassage) => void;
  readonly onIntent?: (() => void) | undefined;
  readonly autoFocus?: boolean;
}

const NUMBER_PARTS = ['chapter', 'start', 'end'] as const;
const LABELS = {
  book: '책',
  chapter: '장',
  start: '시작절',
  end: '끝절',
} as const;
const ignorePreview = (): void => undefined;

/** Shares book completion and endpoint validation across Show and Prep. */
export function BibleReferenceForm(
  props: BibleReferenceFormProps,
): JSX.Element {
  const [fields, setFields] = useState(EMPTY_REFERENCE);
  const [open, setOpen] = useState(false);
  const [pointed, setPointed] = useState(-1);
  const [blocked, setBlocked] = useState<ReferencePart | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const bookAnchor = useRef<HTMLDivElement>(null);
  const listId = useId();
  const book = selectedBook(fields.book);
  const metadata = useBibleLookup({
    ...props,
    input: book?.korean ?? '',
    onPreview: ignorePreview,
  });
  const state = referenceFieldsState(fields, metadata?.bounds);
  const reply = useBibleLookup({...props, input: state.input});
  const passage = reply?.result.ok ? reply.result.value : undefined;
  const books = findBibleBooks(fields.book);
  const suggestions: readonly BibleSuggestion[] = books.map(candidate => ({
    key: `book:${candidate.id}`,
    bookId: candidate.id,
    group: '책',
    input: candidate.korean,
    translation: props.translation,
  }));
  const expanded = props.translation !== undefined && open && books.length > 0;
  const change = (part: ReferencePart, value: string): void => {
    props.onIntent?.();
    setFields(previous => changeReferenceField(previous, part, value));
    setBlocked(null);
    if (part === 'book') {
      setPointed(-1);
      setOpen(true);
    }
  };
  const choose = (name: string): void => {
    change('book', name);
    setOpen(false);
  };
  const reason = (part: ReferencePart): string | undefined => {
    if (part === 'book' && book && metadata && !metadata.bounds) {
      return '역본에 없는 책';
    }
    if (part === 'start' && reply?.result.ok === false) {
      return reply.result.error.code === 'omitted'
        ? '역본에 없는 절'
        : '구절 조회 실패';
    }
    return fields[part] !== '' || blocked === part
      ? state.errors[part]
      : undefined;
  };
  const onKeyDown = (
    part: ReferencePart,
    event: KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (isComposing(event) || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (part === 'book') {
      if (event.key === 'Escape' && expanded) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true);
        setPointed(previous =>
          event.key === 'ArrowDown'
            ? Math.min(previous + 1, books.length - 1)
            : previous < 0
              ? books.length - 1
              : Math.max(0, previous - 1),
        );
        return;
      }
      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        const candidate = books[pointed] ?? book;
        if (!candidate) {
          setBlocked('book');
          return;
        }
        choose(candidate.korean);
        root.current
          ?.querySelector<HTMLInputElement>('[data-reference-part="chapter"]')
          ?.focus();
        return;
      }
    }
    if (event.key === 'Tab' && !event.shiftKey && state.errors[part]) {
      event.preventDefault();
      setBlocked(part);
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat || props.translation === undefined) return;
    const candidate = part === 'book' && expanded ? books[pointed] : undefined;
    if (candidate) {
      choose(candidate.korean);
      return;
    }
    if (passage) {
      if (fields.end !== '' && state.clampedEnd !== undefined) {
        setFields(previous => ({...previous, end: String(state.clampedEnd)}));
      }
      setOpen(false);
      props.onSubmit(passage);
    } else {
      setBlocked(part);
    }
  };
  return (
    <div ref={root} className={styles.form} role="group" aria-label="성경 구절">
      <div ref={bookAnchor} className={styles.book}>
        <TextField
          size="sm"
          block
          icon="book"
          clearable
          autoFocus={props.autoFocus}
          aria-label="책"
          placeholder="책"
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
          disabled={props.translation === undefined}
          invalid={reason('book') !== undefined}
          invalidReason={reason('book')}
        />
      </div>
      {NUMBER_PARTS.map(part => (
        <TextField
          key={part}
          size="sm"
          block
          inputMode="numeric"
          aria-label={LABELS[part]}
          placeholder={LABELS[part]}
          data-reference-part={part}
          maxLength={BIBLE_LOOKUP_LIMITS.input}
          value={fields[part]}
          onChange={value => change(part, value)}
          onKeyDown={event => onKeyDown(part, event)}
          disabled={props.translation === undefined}
          invalid={reason(part) !== undefined}
          invalidReason={reason(part)}
        />
      ))}
      {expanded ? (
        <BibleSuggestions
          id={listId}
          anchor={bookAnchor}
          items={suggestions}
          pointed={pointed}
          onPoint={setPointed}
          onChoose={item => choose(item.input)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
