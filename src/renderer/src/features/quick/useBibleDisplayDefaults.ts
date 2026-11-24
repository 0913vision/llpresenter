import {followLatest} from '@renderer/platform/followLatest';
import {useEffect, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleDisplay} from '@renderer/session/show/bibleSource';
import type {Preferences} from '@core/schema/app/preferences';

/**
 * Follows the 절 번호 a new passage starts with, without replacing a push with a
 * stale startup read. Its translation name follows the passage's translation.
 */
export function useBibleDisplayDefaults(
  api: LlpApi['preferences'] | undefined,
): BibleDisplay | null {
  const [value, setValue] = useState<{
    readonly owner: LlpApi['preferences'];
    readonly display: BibleDisplay;
  } | null>(null);
  useEffect(() => {
    if (api === undefined) return undefined;
    const receive = (preferences: Preferences): void => {
      const {verseNumbers} = preferences.bible.defaults;
      setValue(previous =>
        previous?.owner === api &&
        previous.display.verseNumbers === verseNumbers
          ? previous
          : {owner: api, display: {verseNumbers}},
      );
    };
    return followLatest(
      {read: api.get, subscribe: api.subscribe},
      {
        apply: receive,
        failed: (error, pushed) => {
          if (!pushed) {
            console.error('Could not read Bible display preferences', error);
          }
        },
      },
    );
  }, [api]);
  return value !== null && value.owner === api ? value.display : null;
}
