import {useEffect, useState} from 'react';
import type {BibleLookupReply} from '@shared/schema/bibleLookup';
import {createLatestRunner} from './latestRunner';
import type {PassageDefaults} from './quickAddBible';

interface BibleSources {
  readonly defaults: PassageDefaults | null;
  // NOTE(0913vision): The reply for the typed reference, `null` until it arrives.
  readonly reply: BibleLookupReply | null;
}

// NOTE(0913vision): While the popover types a reference, the default
// translation and the verse number preference are read once, and each
// reference is looked up offline, one at a time with only the newest input
// waiting; closing forgets the answers, and a reply counts only for the input
// and translation shown.
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
      setDefaults(null);
      setReply(null);
    };
  }, [typing]);
  const translation = defaults?.translation;
  const [runner] = useState(createLatestRunner);
  useEffect(() => {
    const api = window.llp;
    if (!typing || api === undefined || translation === undefined) {
      return undefined;
    }
    let alive = true;
    const isAlive = (): boolean => alive;
    runner.submit(async () => {
      if (!isAlive()) return;
      try {
        const answer = await api.bible.lookup({translation, input});
        if (isAlive()) setReply(answer);
      } catch (error: unknown) {
        console.error('Quick add Bible lookup failed', error);
      }
    });
    return () => {
      alive = false;
    };
  }, [runner, typing, input, translation]);
  return {
    defaults,
    reply:
      reply?.input === input && reply.translation === translation
        ? reply
        : null,
  };
}
