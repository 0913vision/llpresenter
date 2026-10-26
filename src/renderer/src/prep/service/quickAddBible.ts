import {createServiceItemId} from '@shared/schema/ids';
import type {BibleLookupReply} from '@shared/schema/bibleLookup';
import type {ServiceItem} from '@shared/schema/service';
import type {MenuEntry} from '@renderer/ui/menuModel';

export interface PassageDefaults {
  readonly translation: BibleLookupReply['translation'];
  readonly verseNumbers: boolean;
}

/** A passage item with the default settings of a new Bible item (spec 05). */
export function passageItem(
  ref: string,
  {translation, verseNumbers}: PassageDefaults,
): ServiceItem {
  return {
    id: createServiceItemId(crypto.randomUUID()),
    bible: {
      translation,
      ref,
      split: 'verse',
      reference: 'every',
      verseNumbers,
      translationName: false,
    },
  };
}

/**
 * The popover's rows for a reference being typed: the typed passage when it
 * is valid, then the books it could still become with their resolved range.
 */
export function bibleEntries(
  reply: BibleLookupReply | null,
  onInsert: (ref: string) => void,
): readonly MenuEntry[] {
  if (reply === null) return [];
  const typed: readonly MenuEntry[] = reply.result.ok
    ? [
        {
          kind: 'item',
          id: 'bible:typed',
          label: reply.result.value.displayRef,
          icon: 'book',
          meta: `절 ${reply.result.value.verses.length}개`,
          onSelect: () => {
            if (reply.result.ok) onInsert(reply.result.value.ref);
          },
        },
      ]
    : [];
  const suggestions = reply.suggestions.flatMap(
    (suggestion): readonly MenuEntry[] => {
      const {resolved} = suggestion;
      if (resolved === undefined) return [];
      if (reply.result.ok && reply.result.value.ref === resolved.ref) return [];
      return [
        {
          kind: 'item',
          id: `bible:${suggestion.bookId}:${suggestion.input}`,
          label: suggestion.name,
          icon: 'book',
          meta: `절 ${resolved.verseCount}개`,
          onSelect: () => onInsert(resolved.ref),
        },
      ];
    },
  );
  return [...typed, ...suggestions];
}
