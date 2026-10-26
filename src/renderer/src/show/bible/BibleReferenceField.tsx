import {useId, useRef, useState, type JSX, type KeyboardEvent} from 'react';
import type {LlpApi} from '@shared/ipc';
import {recentPassages} from '@shared/bibleRecents';
import {bibleBookChoices, completeBibleBook} from '@shared/bibleCompletion';
import type {RecentPassage} from '@shared/schema/bible';
import {
  BIBLE_LOOKUP_LIMITS,
  type BibleLookupPassage,
} from '@shared/schema/bibleLookup';
import type {TranslationId} from '@shared/schema/ids';
import {TextField} from '@renderer/ui';
import {isComposing} from '@renderer/ui/ime';
import {useInputCompletion} from '@renderer/ui/useInputCompletion';
import {BibleSuggestions, type BibleSuggestion} from './BibleSuggestions';
import {useBibleLookup} from './useBibleLookup';
import styles from './BibleReferenceField.module.css';

export interface BibleReferenceFieldProps {
  readonly api: LlpApi['bible'];
  readonly translation: TranslationId | undefined;
  readonly recents: readonly RecentPassage[];
  readonly onPreview: (passage: BibleLookupPassage) => void;
  readonly onShow: (passage: BibleLookupPassage) => void;
  readonly onIntent?: (() => void) | undefined;
}

/** A reference combobox; choosing a different suggestion previews before output. */
export function BibleReferenceField(
  props: BibleReferenceFieldProps,
): JSX.Element {
  const [input, setInput] = useState('');
  const [choice, setChoice] = useState({
    provided: props.translation,
    selected: props.translation,
  });
  const [open, setOpen] = useState(false);
  const [pointedKey, setPointedKey] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const translation =
    choice.provided === props.translation ? choice.selected : props.translation;
  if (choice.provided !== props.translation) {
    setChoice({provided: props.translation, selected: props.translation});
  }
  const reply = useBibleLookup({...props, input, translation});
  const passage = reply?.result.ok ? reply.result.value : undefined;
  const books = bibleBookChoices(input);
  const suggestions: readonly BibleSuggestion[] = [
    ...books.map(book => {
      const resolved =
        reply?.suggestions.find(s => s.bookId === book.bookId)?.resolved ??
        (passage?.ref.startsWith(`${book.name} `)
          ? {
              ref: passage.ref,
              verseCount: passage.verses.length,
            }
          : undefined);
      return {
        key: `book:${book.bookId}`,
        bookId: book.bookId,
        group: '구절',
        input: book.input,
        ref: resolved?.ref,
        translation,
        count: resolved?.verseCount,
      };
    }),
    ...recentPassages(props.recents).map(recent => ({
      key: `recent:${recent.translation}:${recent.ref}`,
      group: '최근',
      input: recent.ref,
      ref: recent.ref,
      translation: recent.translation,
    })),
  ];
  const selected = suggestions.findIndex(item => item.key === pointedKey);
  const pointed = selected >= 0 ? selected : books.length > 0 ? 0 : -1;
  const point = (index: number): void =>
    setPointedKey(suggestions[index]?.key ?? null);
  const expanded = translation !== undefined && open && suggestions.length > 0;
  const change = (value: string): void => {
    props.onIntent?.();
    setInput(value);
    setPointedKey(null);
    setOpen(true);
  };
  const complete = useInputCompletion(change);
  const choose = (suggestion: BibleSuggestion): void => {
    setChoice({provided: props.translation, selected: suggestion.translation});
    change(suggestion.input);
    setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (isComposing(event) || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (
      event.key === 'Tab' &&
      complete(
        event,
        completeBibleBook({
          input,
          start: event.currentTarget.selectionStart ?? input.length,
          end: event.currentTarget.selectionEnd ?? input.length,
          bookId: suggestions[pointed]?.bookId,
        }),
      )
    ) {
      setOpen(false);
      return;
    }
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      point(
        event.key === 'ArrowDown'
          ? Math.min(pointed + 1, suggestions.length - 1)
          : pointed < 0
            ? suggestions.length - 1
            : Math.max(0, pointed - 1),
      );
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    const suggestion = expanded ? suggestions[pointed] : undefined;
    if (
      suggestion &&
      (!reply?.result.ok ||
        suggestion.ref !== reply.result.value.ref ||
        suggestion.translation !== translation)
    ) {
      choose(suggestion);
      return;
    }
    if (reply?.result.ok) {
      setOpen(false);
      props.onShow(reply.result.value);
    }
  };
  return (
    <div ref={root} className={styles.field}>
      <TextField
        size="sm"
        icon="book"
        block
        clearable
        aria-label="성경 구절"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={
          expanded && suggestions[pointed] ? `${listId}-${pointed}` : undefined
        }
        placeholder="요 3:16, 창 1:1-5"
        maxLength={BIBLE_LOOKUP_LIMITS.input}
        value={input}
        onChange={change}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        disabled={translation === undefined}
        invalid={input.trim() !== '' && reply?.result.ok === false}
        invalidReason={
          reply?.result.ok === false ? reply.result.error.message : undefined
        }
      />
      {expanded ? (
        <BibleSuggestions
          id={listId}
          anchor={root}
          items={suggestions}
          pointed={pointed}
          onPoint={point}
          onChoose={choose}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
