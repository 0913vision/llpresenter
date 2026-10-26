import {useEffect, useState} from 'react';
import type {PassageDefaults} from './quickAddBible';

export function useBibleDefaults(): PassageDefaults | null {
  const [defaults, setDefaults] = useState<PassageDefaults | null>(null);
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
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
  }, []);
  return defaults;
}
