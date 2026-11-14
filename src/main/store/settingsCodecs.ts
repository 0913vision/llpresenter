import type {Result} from '@core/common/result';
import type {FileError} from '@core/schema/fileFormat';
import * as bible from '@core/schema/bible';
import * as bibleCuts from '@core/schema/bibleCuts';
import * as labels from '@core/schema/labels';
import * as themes from '@core/schema/themes';
import * as macros from '@core/schema/macros';
import * as messages from '@core/schema/messages';
import * as preferences from '@core/schema/preferences';
import * as props from '@core/schema/props';
import * as quick from '@core/schema/quick';
import * as screens from '@core/schema/screens';
import * as shortcuts from '@core/schema/shortcuts';
import * as timers from '@core/schema/timers';
import type {
  SettingsDocument,
  SettingsName,
} from '@core/schema/settingsDocuments';
import type {ParseFile} from './readFiles';
import {createDefaultThemes} from '@core/themes/defaults';
import {isRecord} from '@core/common/guards';
import {isBuiltInThemeId} from '@core/themes/builtInIds';

const builtIns = createDefaultThemes();
const isBuiltIn = (id: unknown) =>
  typeof id === 'string' && isBuiltInThemeId(id);

function parseStoredThemes(text: string, file: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return themes.parseThemes(text, file);
  }
  if (!isRecord(raw) || !Array.isArray(raw.themes)) {
    return themes.parseThemes(text, file);
  }
  const entries: readonly unknown[] = raw.themes;
  const saved = entries.filter(
    theme => !isRecord(theme) || !isBuiltIn(theme.id) || theme.edited === true,
  );
  const overrides = new Map(
    saved.filter(isRecord).map(theme => [theme.id, theme]),
  );
  const standby =
    isRecord(raw.standby) && raw.standby.edited === true
      ? raw.standby
      : builtIns.standby;
  const merged = [
    ...builtIns.themes.map(theme => overrides.get(theme.id) ?? theme),
    ...saved.filter(theme => !isRecord(theme) || !isBuiltIn(theme.id)),
  ];
  const order = Array.isArray(raw.themeOrder) ? raw.themeOrder : [];
  const positions = new Map(order.map((id, index) => [id, index]));
  merged.sort((a, b) => {
    const left = isRecord(a) ? positions.get(a.id) : undefined;
    const right = isRecord(b) ? positions.get(b.id) : undefined;
    return (left ?? order.length) - (right ?? order.length);
  });
  return themes.parseThemes(
    JSON.stringify({
      ...raw,
      standby,
      themes: merged,
    }),
    file,
  );
}

function serializeStoredThemes(value: themes.ThemesFile, file: string) {
  const serialized = themes.serializeThemes(value, file);
  if (!serialized.ok) return serialized;
  const {standby, ...rest} = value;
  const data = {
    ...rest,
    ...(standby.edited === true ? {standby} : {}),
    themes: value.themes.filter(
      theme => !isBuiltIn(theme.id) || theme.edited === true,
    ),
  };
  return {ok: true, value: `${JSON.stringify(data, null, 2)}\n`} as const;
}

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
  themes: codec('llsettings.themes', parseStoredThemes, serializeStoredThemes),
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
