import {useEffect, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';

/** Follows the auto-open preference without a stale read replacing a push. */
export function useBibleReviewPreference(
  api: LlpApi['preferences'] | undefined,
): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    if (api === undefined) return;
    let active = true;
    let pushed = false;
    const stop = api.subscribe(preferences => {
      pushed = true;
      if (active) setEnabled(preferences.bible.splitEditorAutoOpen);
    });
    void api.get().then(
      preferences => {
        if (active && !pushed) {
          setEnabled(preferences.bible.splitEditorAutoOpen);
        }
      },
      (error: unknown) => {
        console.error('Could not read Bible review preference', error);
        if (active && !pushed) setEnabled(true);
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, [api]);
  return enabled;
}
