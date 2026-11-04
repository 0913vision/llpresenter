import {useEffect, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleDisplayOptions} from '@core/bible/source';
import type {Preferences} from '@core/schema/preferences';

/**
 * Follows the Bible defaults for a new passage without
 * replacing a push with a stale startup read.
 */
export function useBibleDisplayDefaults(
  api: LlpApi['preferences'],
): BibleDisplayOptions | null {
  const [value, setValue] = useState<{
    readonly owner: LlpApi['preferences'];
    readonly display: BibleDisplayOptions;
  } | null>(null);
  useEffect(() => {
    let active = true;
    let pushed = false;
    const receive = (preferences: Preferences): void => {
      if (!active) return;
      const {verseNumbers, reference, translationName} =
        preferences.bible.defaults;
      setValue(previous =>
        previous?.owner === api &&
        previous.display.verseNumbers === verseNumbers &&
        previous.display.reference === reference &&
        previous.display.translationName === translationName
          ? previous
          : {owner: api, display: {verseNumbers, reference, translationName}},
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
  return value?.owner === api ? value.display : null;
}
