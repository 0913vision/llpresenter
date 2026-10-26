import {useId, useRef, useState, type JSX, type KeyboardEvent} from 'react';
import type {LlpApi} from '@shared/ipc';
import {recentPassages} from '@shared/bibleRecents';
import type {RecentPassage} from '@shared/schema/bible';
import {
  BIBLE_LOOKUP_LIMITS,
  type BibleLookupPassage,
} from '@shared/schema/bibleLookup';
import type {TranslationId} from '@shared/schema/ids';
import {TextField} from '@renderer/ui';
import {isComposing} from '@renderer/ui/ime';
import {BibleSuggestions, type BibleSuggestion} from './BibleSuggestions';
import {useBibleLookup} from './useBibleLookup';
import styles from './BibleReferenceField.module.css';

export interface BibleReferenceFieldProps {
  readonly api: LlpApi['bible'];
  readonly translation: TranslationId | undefined;
  readonly recents: readonly RecentPassage[];
  readonly onPreview: (passage: BibleLookupPassage) => void;
  readonly onShow: (passage: BibleLookupPassage) => void;
}

/** A reference combobox; choosing a different suggestion previews before output. */
export function BibleReferenceField(
  props: BibleReferenceFieldProps,
): JSX.Element {
  const [input, setInput] = useState('');
  const [chosen, setChosen] = useState<TranslationId | null>(null);
  const [open, setOpen] = useState(false);
  const [pointedKey, setPointedKey] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const translation = chosen ?? props.translation;
  const reply = useBibleLookup({...props, input, translation});
  const suggestions: readonly BibleSuggestion[] = [
    ...(reply?.suggestions.map(book => ({
      key: `book:${book.bookId}`,
      group: '구절',
      input: book.input,
      translation,
      count:
        reply.result.ok && reply.result.value.ref === book.input
          ? reply.result.value.verses.length
          : undefined,
    })) ?? []),
    ...recentPassages(props.recents).map(recent => ({
      key: `recent:${recent.translation}:${recent.ref}`,
      group: '최근',
      input: recent.ref,
      translation: recent.translation,
    })),
  ];
  const pointed = suggestions.findIndex(item => item.key === pointedKey);
  const point = (index: number): void =>
    setPointedKey(suggestions[index]?.key ?? null);
  const expanded = open && suggestions.length > 0;
  const change = (value: string): void => {
    setInput(value);
    setPointedKey(null);
    setOpen(true);
  };
  const choose = (suggestion: BibleSuggestion): void => {
    setChosen(suggestion.translation ?? null);
    change(suggestion.input);
    setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (isComposing(event) || event.altKey || event.ctrlKey || event.metaKey) {
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
    const suggestion = expanded ? suggestions[pointed] : undefined;
    if (
      suggestion &&
      (!reply?.result.ok ||
        suggestion.input !== reply.result.value.ref ||
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
