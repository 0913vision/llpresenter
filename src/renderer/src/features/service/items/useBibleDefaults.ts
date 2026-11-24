import {useEffect, useState} from 'react';
import {LIVE_BIBLE_ID} from '@core/bible';
import type {TranslationId} from '@core/schema/common/ids';
import type {Preferences} from '@core/schema/app/preferences';
import type {PassageDefaults} from './passageItems';

export interface BibleDefaults extends PassageDefaults {
  readonly translation: TranslationId;
}

/** The translation and the settings a new passage starts with. */
export function useBibleDefaults(): BibleDefaults | null {
  const [defaults, setDefaults] = useState<BibleDefaults | null>(null);
  useEffect(() => {
    const api = window.llp;
    if (api === undefined) return undefined;
    let current = true;
    let translation: TranslationId | undefined;
    let preferences: Preferences | undefined;
    const publish = (): void => {
      if (!current || translation === undefined || preferences === undefined) {
        return;
      }
      const {verseNumbers, translationName} = preferences.bible.defaults;
      setDefaults({translation, verseNumbers, translationName});
    };
    const stop = api.preferences.subscribe(value => {
      preferences = value;
      publish();
    });
    const failed = (error: unknown): void =>
      console.error('Could not read the Bible defaults', error);
    api.settings.get({name: 'bible'}).then(bible => {
      if (bible.name !== 'bible') return;
      translation =
        (
          bible.value.translations.find(item => item.default) ??
          bible.value.translations[0]
        )?.id ?? LIVE_BIBLE_ID;
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
