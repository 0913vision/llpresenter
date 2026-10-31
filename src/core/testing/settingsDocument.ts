import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsName,
} from '../schema/settingsDocuments';

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
