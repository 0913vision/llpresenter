import {useEffect, useState} from 'react';
import {type TranslationId, LIVE_BIBLE_ID} from '@core/schema/common/ids';
import type {Preferences} from '@core/schema/app/preferences';
import type {Translation} from '@core/schema/bible/bible';
import {defaultTranslationOf} from '@core/bible';
import type {PassageDefaults} from './passageItems';

/** The translation and the settings a new passage starts with. */
export function useBibleDefaults(): PassageDefaults | null {
  const [defaults, setDefaults] = useState<PassageDefaults | null>(null);
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let current = true;
    let translation: TranslationId | undefined;
    let translations: readonly Translation[] = [];
    let preferences: Preferences | undefined;
    const publish = (): void => {
      if (!current || translation === undefined || preferences === undefined) {
        return;
      }
      const {verseNumbers} = preferences.bible.defaults;
      setDefaults({translation, translations, verseNumbers});
    };
    const stop = api.preferences.subscribe(value => {
      preferences = value;
      publish();
    });
    const failed = (error: unknown): void =>
      console.error('Could not read the Bible defaults', error);
    api.settings.get({name: 'bible'}).then(bible => {
      if (bible.name !== 'bible') return;
      translations = bible.value.translations;
      translation = defaultTranslationOf(translations) ?? LIVE_BIBLE_ID;
      publish();
    }, failed);
    api.preferences.get().then(value => {
      preferences ??= value;
      publish();
    }, failed);
    return () => {
      current = false;
      stop();
    };
  }, []);
  return defaults;
}
