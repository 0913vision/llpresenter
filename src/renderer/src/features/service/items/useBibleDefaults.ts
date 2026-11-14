import {LIVE_BIBLE_ID} from '@core/bible/liveTranslation';
import {useEffect, useState} from 'react';
import type {Preferences} from '@core/schema/preferences';
import type {PassageDefaults} from './quickAddBible';

export function useBibleDefaults(): PassageDefaults | null {
  const [defaults, setDefaults] = useState<PassageDefaults | null>(null);
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let current = true;
    let translation: PassageDefaults['translation'] | undefined;
    let preferences: Preferences | undefined;
    const publish = (): void => {
      if (!current || translation === undefined || preferences === undefined) {
        return;
      }
      setDefaults({translation, ...preferences.bible.defaults});
    };
    const removePreferences = api.preferences.subscribe(value => {
      preferences = value;
      publish();
    });
    const readFailed = (error: unknown): void =>
      console.error('Quick add Bible read failed', error);
    api.settings.get({name: 'bible'}).then(bible => {
      if (!current || bible.name !== 'bible') return;
      translation =
        (
          bible.value.translations.find(item => item.default) ??
          bible.value.translations[0]
        )?.id ?? LIVE_BIBLE_ID;
      publish();
    }, readFailed);
    api.preferences.get().then(value => {
      preferences ??= value;
      publish();
    }, readFailed);
    return () => {
      current = false;
      removePreferences();
    };
  }, []);
  return defaults;
}
