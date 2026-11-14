import {createDefaultThemes} from '@core/themes/defaults';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
/** Checked screen and theme documents for editor tests and offscreen previews. */
export function editorPreviewFixture() {
  const screens = parseSettingsDocument({
    name: 'screens',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llsettings.screens',
      schemaVersion: 1,
      screens: Object.entries(STARTER_SCREEN_IDS).map(([role, id]) => ({
        id,
        name: role,
        kind:
          role === 'stage'
            ? 'stage'
            : role === 'broadcast'
              ? 'broadcast'
              : 'audience',
        method: role === 'broadcast' ? 'capture' : 'fullscreen',
      })),
    },
  });
  if (!screens.ok || screens.value.name !== 'screens') {
    throw new Error('Invalid preview fixture');
  }
  const themes = settingsDocument(
    'themes',
    createDefaultThemes(screens.value.value.screens),
  );
  if (themes.name !== 'themes') throw new Error('Invalid theme fixture');
  return {screens: screens.value, themes};
}
