import {useEffect, useState} from 'react';
import type {ThemeId} from '@core/schema/common/ids';
import {hasSlides, type ServiceItem} from '@core/schema/services/service';
import {countServiceItemUses} from '@renderer/features/service/serviceItemUsage';

/** The number of items with slides of a theme, or why it isn't known. */
export type ThemeUsage = number | 'loading' | 'failed';

function usesTheme(item: ServiceItem, theme: ThemeId): boolean {
  return hasSlides(item) && item.slides.some(slide => slide.theme === theme);
}

/** Counts the items that use a theme while `enabled`. */
export function useThemeUsage(
  theme: ThemeId | undefined,
  enabled: boolean,
): ThemeUsage {
  const [counted, setCounted] = useState<{
    readonly theme: ThemeId;
    readonly usage: number | 'failed';
  } | null>(null);
  const api = window.llp;
  useEffect(() => {
    if (!enabled || api === undefined || theme === undefined) return;
    const controller = new AbortController();
    countServiceItemUses(api, item => usesTheme(item, theme), controller.signal)
      .then(usage => setCounted({theme, usage}))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        api.log.write({
          level: 'error',
          message: 'Could not count the items that use a theme',
          detail: error instanceof Error ? error.message : String(error),
        });
        setCounted({theme, usage: 'failed'});
      });
    return () => {
      controller.abort();
      setCounted(null);
    };
  }, [api, enabled, theme]);
  return counted !== null && counted.theme === theme
    ? counted.usage
    : 'loading';
}
