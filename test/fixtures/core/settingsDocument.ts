import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/settingsDocuments';

/** A valid settings document of the named file, with the given fields. */
export function settingsDocument(
  name: SettingsName,
  value: object,
  revision = 1,
): SettingsDocument {
  const result = parseSettingsDocument({
    name,
    value: {
      format: `llsettings.${name}`,
      schemaVersion: 1,
      ...value,
    },
    revision,
    access: 'editable',
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const EMPTY: Readonly<Record<SettingsName, object>> = {
  themes: {themes: [], defaults: {}, titles: []},
  screens: {screens: []},
  macros: {macros: [], collections: []},
  quick: {items: []},
  messages: {templates: []},
  props: {props: []},
  timers: {timers: []},
  labels: {labels: [], defaultVerseLabelVersion: 1},
  bibleCuts: {entries: {}},
  preferences: {},
  shortcuts: {bindings: {}},
  bible: {translations: [], recents: []},
};

/** A valid settings document of the named file with nothing in it. */
export function emptySettingsDocument(name: SettingsName): SettingsDocument {
  return settingsDocument(name, EMPTY[name]);
}
