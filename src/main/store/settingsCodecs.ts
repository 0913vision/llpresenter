import type {Result} from '@shared/result';
import type {FileError} from '@shared/schema/fileFormat';
import * as bible from '@shared/schema/bible';
import * as labels from '@shared/schema/labels';
import * as looks from '@shared/schema/looks';
import * as macros from '@shared/schema/macros';
import * as messages from '@shared/schema/messages';
import * as notices from '@shared/schema/notices';
import * as preferences from '@shared/schema/preferences';
import * as props from '@shared/schema/props';
import * as quick from '@shared/schema/quick';
import * as screens from '@shared/schema/screens';
import * as shortcuts from '@shared/schema/shortcuts';
import * as stage from '@shared/schema/stageLayouts';
import * as timers from '@shared/schema/timers';
import type {
  SettingsDocument,
  SettingsName,
} from '@shared/schema/settingsDocuments';
import type {ParseFile} from './readFiles';

export type SettingsValue = SettingsDocument['value'];
function codec<T extends SettingsValue>(
  format: T['format'],
  parse: ParseFile<T>,
  serialize: (data: T, file: string) => Result<string, FileError>,
) {
  return {
    format,
    parse,
    serialize: (data: SettingsValue, file: string) => {
      const checked = parse(JSON.stringify(data), file);
      return checked.ok ? serialize(checked.value.data, file) : checked;
    },
  };
}

/** Reuses file validation, migration and serialization from the M2 store. */
export const settingsCodecs = {
  screens: codec(
    'llsettings.screens',
    screens.parseScreens,
    screens.serializeScreens,
  ),
  looks: codec('llsettings.looks', looks.parseLooks, looks.serializeLooks),
  'stage-layouts': codec(
    'llsettings.stage',
    stage.parseStageLayouts,
    stage.serializeStageLayouts,
  ),
  macros: codec(
    'llsettings.macros',
    macros.parseMacros,
    macros.serializeMacros,
  ),
  quick: codec('llsettings.quick', quick.parseQuick, quick.serializeQuick),
  messages: codec(
    'llsettings.messages',
    messages.parseMessages,
    messages.serializeMessages,
  ),
  notices: codec(
    'llsettings.notices',
    notices.parseNotices,
    notices.serializeNotices,
  ),
  props: codec('llsettings.props', props.parseProps, props.serializeProps),
  timers: codec(
    'llsettings.timers',
    timers.parseTimers,
    timers.serializeTimers,
  ),
  labels: codec(
    'llsettings.labels',
    labels.parseLabels,
    labels.serializeLabels,
  ),
  bible: codec('llsettings.bible', bible.parseBible, bible.serializeBible),
  preferences: codec(
    'llsettings.preferences',
    preferences.parsePreferences,
    preferences.serializePreferences,
  ),
  shortcuts: codec(
    'llsettings.shortcuts',
    shortcuts.parseShortcuts,
    shortcuts.serializeShortcuts,
  ),
} satisfies Record<
  SettingsName,
  {format: SettingsValue['format']; parse: ParseFile<SettingsValue>}
>;
