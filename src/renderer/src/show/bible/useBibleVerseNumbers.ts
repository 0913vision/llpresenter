import {useEffect, useState} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {Preferences} from '@shared/schema/preferences';

/** Follows the Bible default without replacing a push with a stale startup read. */
export function useBibleVerseNumbers(
  api: LlpApi['preferences'],
): boolean | null {
  const [value, setValue] = useState<{
    readonly owner: LlpApi['preferences'];
    readonly numbers: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    let pushed = false;
    const receive = (preferences: Preferences): void => {
      if (!active) return;
      const numbers = preferences.bible.verseNumbers;
      setValue(previous =>
        previous?.owner === api && previous.numbers === numbers
          ? previous
          : {owner: api, numbers},
      );
    };
    const stop = api.subscribe(preferences => {
      pushed = true;
      receive(preferences);
    });
    void api.get().then(
      preferences => {
        if (!pushed) receive(preferences);
      },
      (error: unknown) => {
        if (active && !pushed) {
          console.error('Could not read Bible display preferences', error);
        }
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, [api]);
  return value?.owner === api ? value.numbers : null;
}
