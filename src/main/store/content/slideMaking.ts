import {defaultSlideTransitions} from '@core/schema/app/preferences';
import type {SlideMaking} from '@core/slides';
import type {SettingsStore} from '../settings/settingsStore';

/**
 * What new slides are made with on the main side: the themes and the 환경설정
 * transitions, or the built-in ones before the settings are read.
 */
export function slideMakingOf(
  settings: SettingsStore | null | undefined,
): SlideMaking {
  const themes = settings?.get('themes');
  return {
    themes: themes?.name === 'themes' ? themes.value : null,
    transitions:
      settings?.preferences().show.slideDefaults ?? defaultSlideTransitions,
  };
}
