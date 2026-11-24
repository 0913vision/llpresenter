import type {SettingsReader} from '@core/schema/app/settingsReader';
import type {MacrosFile} from '@core/schema/tools/macros';
import type {MediaList} from '@core/schema/media/mediaList';
import type {MessagesFile} from '@core/schema/tools/messages';
import type {PropsFile} from '@core/schema/tools/props';
import type {ScreensFile} from '@core/schema/screens/screens';
import type {TimersFile} from '@core/schema/tools/timers';
import type {Themes} from '@core/schema/screens/themes';

/**
 * What a 매크로 compiles against: the themes, macros, media, messages, props and
 * screens that exist now.
 */
export interface MacroCatalog {
  readonly themes: Themes;
  readonly macros: MacrosFile;
  readonly media: MediaList;
  readonly messages: MessagesFile;
  readonly props: PropsFile;
  readonly screens: ScreensFile;
  readonly timers: TimersFile;
}

/** Reads the catalog from the settings and the current media list. */
export function readMacroCatalog(
  settings: SettingsReader,
  media: MediaList,
): MacroCatalog {
  const macros = settings.get('macros');
  const themes = settings.get('themes');
  const messages = settings.get('messages');
  const props = settings.get('props');
  const screens = settings.get('screens');
  const timers = settings.get('timers');
  if (
    macros.name !== 'macros' ||
    themes.name !== 'themes' ||
    messages.name !== 'messages' ||
    props.name !== 'props' ||
    screens.name !== 'screens' ||
    timers.name !== 'timers'
  ) {
    throw new Error('Macro settings are unavailable');
  }
  return {
    macros: macros.value,
    themes: themes.value,
    media,
    messages: messages.value,
    props: props.value,
    screens: screens.value,
    timers: timers.value,
  };
}
