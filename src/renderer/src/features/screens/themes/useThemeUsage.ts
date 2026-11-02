import {useEffect, useState} from 'react';
import type {ThemeId} from '@core/schema/ids';
import type {ThemesFile} from '@core/schema/themes';
import {itemUsesTheme} from '@core/themes/themeUsage';
import {countServiceItemUses} from '@renderer/features/service/serviceItemUsage';

/** The number of 예배 순서 items a 테마 sets, or why it isn't known. */
export type ThemeUsage = number | 'loading' | 'failed';

/** Counts the items that use a 테마 while `enabled`, and stops when it stops. */
export function useThemeUsage(
  themeId: ThemeId | undefined,
  defaults: ThemesFile['defaults'] | undefined,
  enabled: boolean,
): ThemeUsage {
  const [counted, setCounted] = useState<{
    themeId: ThemeId;
    usage: number | 'failed';
  } | null>(null);
  const api = window.llp;
  useEffect(() => {
    if (!enabled || api === undefined || themeId === undefined) return;
    if (defaults === undefined) return;
    const controller = new AbortController();
    countServiceItemUses(
      api,
      item => itemUsesTheme(item, themeId, defaults),
      controller.signal,
    )
      .then(usage => setCounted({themeId, usage}))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        api.log.write({
          level: 'error',
          message: 'Could not count the items that use a theme',
          detail: error instanceof Error ? error.message : String(error),
        });
        setCounted({themeId, usage: 'failed'});
      });
    return () => {
      controller.abort();
      setCounted(null);
    };
  }, [api, defaults, enabled, themeId]);
  return counted !== null && counted.themeId === themeId
    ? counted.usage
    : 'loading';
}
