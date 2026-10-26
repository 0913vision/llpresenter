import {useEffect, useState} from 'react';
import type {BibleLookupReply} from '@shared/schema/bibleLookup';
import type {PassageDefaults} from './quickAddBible';

interface BibleSources {
  readonly defaults: PassageDefaults | null;
  // NOTE(0913vision): The reply for the typed reference, `null` until it arrives.
  readonly reply: BibleLookupReply | null;
}

// NOTE(0913vision): While the popover types a reference, the default
// translation and the verse number preference are read once, and each
// reference is looked up offline; an answer for an older input is dropped.
export function useBibleLookup(typing: boolean, input: string): BibleSources {
  const [defaults, setDefaults] = useState<PassageDefaults | null>(null);
  const [reply, setReply] = useState<BibleLookupReply | null>(null);
  useEffect(() => {
    const api = window.llp;
    if (!typing || api === undefined) return undefined;
    let current = true;
    Promise.all([
      api.settings.get({name: 'bible'}),
      api.preferences.get(),
    ]).then(
      ([bible, preferences]) => {
        if (!current || bible.name !== 'bible') return;
        const translation = (
          bible.value.translations.find(item => item.default) ??
          bible.value.translations[0]
        )?.id;
        if (translation !== undefined) {
          setDefaults({
            translation,
            verseNumbers: preferences.bible.verseNumbers,
          });
        }
      },
      (error: unknown) => console.error('Quick add Bible read failed', error),
    );
    return () => {
      current = false;
    };
  }, [typing]);
  const translation = defaults?.translation;
  useEffect(() => {
    const api = window.llp;
    if (!typing || api === undefined || translation === undefined) {
      return undefined;
    }
    let current = true;
    api.bible.lookup({translation, input}).then(
      answer => {
        if (current && answer.input === input) setReply(answer);
      },
      (error: unknown) => console.error('Quick add Bible lookup failed', error),
    );
    return () => {
      current = false;
    };
  }, [typing, input, translation]);
  return {
    defaults,
    reply: reply?.input === input ? reply : null,
  };
}
