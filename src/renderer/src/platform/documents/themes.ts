import {create} from 'zustand';
import type {LlpApi} from '@contracts/ipc/api';
import type {ShowTile} from '@core/schema/services/showService';
import {
  defaultSlideTransitions,
  withPreferenceDefaults,
  type SlideTransitionDefaults,
} from '@core/schema/app/preferences';
import type {Screen} from '@core/schema/screens/screens';
import type {SettingsName} from '@core/schema/app/settingsDocuments';
import type {ThemeFile} from '@core/schema/screens/theme';
import type {Themes} from '@core/schema/screens/themes';
import type {SlideMaking} from '@core/slides';
import {themeOfSlide} from '@core/theme';

/** The themes and screens as every part of this window draws slides. */
export interface ThemesView {
  readonly themes: Themes | null;
  readonly screens: readonly Screen[];
  readonly transitions: SlideTransitionDefaults;
}

/** This window's copy of the themes and the screens they draw on. */
export const useThemes = create<ThemesView>(() => ({
  themes: null,
  screens: [],
  transitions: defaultSlideTransitions,
}));

/** What new slides are made with. */
export function slideMaking(): SlideMaking {
  const {themes, transitions} = useThemes.getState();
  return {themes, transitions};
}

/** The theme of a slide of a list. */
export function themeOfTile({slide}: ShowTile): ThemeFile {
  return themeOfSlide(useThemes.getState().themes, slide);
}

type Feeds = Pick<LlpApi, 'settings' | 'log'>;

/**
 * Follows the settings that slides are drawn with.
 *
 * @returns A function that stops following. Always call it.
 */
export function startThemesSync(api: Feeds | undefined): () => void {
  if (api === undefined) return () => undefined;
  const revisions = new Map<SettingsName, number>();
  let stopped = false;
  const accept = (
    document: Awaited<ReturnType<Feeds['settings']['get']>>,
  ): void => {
    const known = revisions.get(document.name) ?? -1;
    if (stopped || document.revision < known) return;
    revisions.set(document.name, document.revision);
    if (document.name === 'themes') {
      useThemes.setState({themes: document.value});
    } else if (document.name === 'screens') {
      useThemes.setState({screens: document.value.screens});
    } else if (document.name === 'preferences') {
      const {show} = withPreferenceDefaults(document.value);
      useThemes.setState({transitions: show.slideDefaults});
    }
  };
  const unsubscribe = api.settings.subscribe(accept);
  for (const name of ['themes', 'screens', 'preferences'] as const) {
    api.settings.get({name}).then(accept, (error: unknown) =>
      api.log.write({
        level: 'error',
        message: 'Could not read what slides are drawn with',
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
  }
  return () => {
    stopped = true;
    unsubscribe();
  };
}
