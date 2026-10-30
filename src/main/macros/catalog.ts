import type {LooksFile} from '@core/schema/looks';
import type {MacrosFile} from '@core/schema/macros';
import type {MediaList} from '@core/schema/mediaList';
import type {MessagesFile} from '@core/schema/messages';
import type {NoticesFile} from '@core/schema/notices';
import type {PropsFile} from '@core/schema/props';
import type {ScreensFile} from '@core/schema/screens';
import type {StageLayoutsFile} from '@core/schema/stageLayouts';
import type {TimersFile} from '@core/schema/timers';
import type {SettingsReader} from '../store/settingsStore';

export interface MacroCatalog {
  readonly macros: MacrosFile;
  readonly looks: LooksFile;
  readonly media: MediaList;
  readonly messages: MessagesFile;
  readonly notices: NoticesFile;
  readonly props: PropsFile;
  readonly screens: ScreensFile;
  readonly layouts: StageLayoutsFile;
  readonly timers: TimersFile;
}

export function readMacroCatalog(
  settings: SettingsReader,
  media: MediaList,
): MacroCatalog {
  const macros = settings.get('macros');
  const looks = settings.get('looks');
  const messages = settings.get('messages');
  const notices = settings.get('notices');
  const props = settings.get('props');
  const screens = settings.get('screens');
  const layouts = settings.get('stage-layouts');
  const timers = settings.get('timers');
  if (
    macros.name !== 'macros' ||
    looks.name !== 'looks' ||
    messages.name !== 'messages' ||
    notices.name !== 'notices' ||
    props.name !== 'props' ||
    screens.name !== 'screens' ||
    layouts.name !== 'stage-layouts' ||
    timers.name !== 'timers'
  ) {
    throw new Error('Macro settings are unavailable');
  }
  return {
    macros: macros.value,
    looks: looks.value,
    media,
    messages: messages.value,
    notices: notices.value,
    props: props.value,
    screens: screens.value,
    layouts: layouts.value,
    timers: timers.value,
  };
}
