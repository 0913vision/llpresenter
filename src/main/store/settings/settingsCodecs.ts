import type {Result} from '@core/common/result';
import * as bible from '@core/schema/bible/bible';
import * as bibleCuts from '@core/schema/bible/bibleCuts';
import * as labels from '@core/schema/services/labels';
import * as macros from '@core/schema/tools/macros';
import * as messages from '@core/schema/tools/messages';
import * as preferences from '@core/schema/app/preferences';
import * as props from '@core/schema/tools/props';
import * as quick from '@core/schema/tools/quick';
import * as screens from '@core/schema/screens/screens';
import * as shortcuts from '@core/schema/app/shortcuts';
import * as timers from '@core/schema/tools/timers';
import type {
  SettingsDocument,
  SettingsName,
} from '@core/schema/app/settingsDocuments';
import type {ParseFile} from '../files/readFiles';
import {
  parseFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
} from '@core/schema/common/fileFormat';
import {themesSchema, type Themes} from '@core/schema/screens/themes';

const themesFormat: FileFormat<typeof themesSchema> = {
  format: 'llsettings.themes',
  schema: themesSchema,
  migrations: [],
};

// NOTE(0913vision): The themes are kept in a file each, so this codec only
// checks them as one value; `themeFiles.ts` reads and writes the files.
function parseThemes(
  text: string,
  file: string,
): Result<LoadedFile<Themes>, FileError> {
  return parseFile(themesFormat, text, file);
}

/** The value of any settings document. */
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

/** Reuses file validation, migration and serialization from the file schemas. */
export const settingsCodecs = {
  screens: codec(
    'llsettings.screens',
    screens.parseScreens,
    screens.serializeScreens,
  ),
  themes: codec('llsettings.themes', parseThemes, value => ({
    ok: true,
    value: JSON.stringify(value),
  })),
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
  bibleCuts: codec(
    'llsettings.bibleCuts',
    bibleCuts.parseBibleCuts,
    bibleCuts.serializeBibleCuts,
  ),
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
