import type {LooksFile} from '@shared/schema/looks';
import type {MacrosFile} from '@shared/schema/macros';
import type {MediaList} from '@shared/schema/mediaList';
import type {MessagesFile} from '@shared/schema/messages';
import type {NoticesFile} from '@shared/schema/notices';
import type {PropsFile} from '@shared/schema/props';
import type {ScreensFile} from '@shared/schema/screens';
import type {StageLayoutsFile} from '@shared/schema/stageLayouts';
import type {TimersFile} from '@shared/schema/timers';
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
