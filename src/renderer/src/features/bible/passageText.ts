import {useEffect, useState} from 'react';
import type {BiblePassage} from '@core/schema/biblePassage';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';

type Reference = Pick<BiblePassage, 'translation' | 'ref'>;

const texts = new Map<string, Promise<BibleLookupPassage | null>>();

/** What a passage says in its translation; null when it can't be read. */
export function passageText({
  translation,
  ref,
}: Reference): Promise<BibleLookupPassage | null> {
  const api = window.llp;
  if (api === undefined) return Promise.resolve(null);
  const key = `${translation}:${ref}`;
  let text = texts.get(key);
  if (text === undefined) {
    // NOTE(0913vision): A passage that could not be read is read again.
    const unread = (): null => {
      texts.delete(key);
      return null;
    };
    text = api.bible.lookup({translation, input: ref}).then(
      reply => (reply.result.ok ? reply.result.value : unread()),
      (error: unknown) => {
        console.error('Could not read a Bible passage', error);
        return unread();
      },
    );
    texts.set(key, text);
  }
  return text;
}

/** The text of the passage of an item, once it is read. */
export function usePassageText(
  passage: Reference | undefined,
): BibleLookupPassage | null {
  const translation = passage?.translation;
  const ref = passage?.ref;
  const key = `${translation}:${ref}`;
  const [read, setRead] = useState<{
    readonly key: string;
    readonly text: BibleLookupPassage | null;
  }>({key: '', text: null});
  useEffect(() => {
    if (translation === undefined || ref === undefined) return undefined;
    let current = true;
    passageText({translation, ref}).then(
      text => {
        if (current) setRead({key, text});
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [translation, ref, key]);
  return read.key === key ? read.text : null;
}
