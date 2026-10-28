import {STARTER_SCREEN_IDS} from '@shared/screens';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import {DEFAULT_MESSAGE_STYLE} from '@shared/schema/looks';
const DEFAULT_LYRIC_STYLE = {
  ...DEFAULT_MESSAGE_STYLE,
  referencePosition: 'bottomRight' as const,
};

const STYLE_ID = '00000000-0000-4000-8000-000000000010';

/** Checked current-Look documents for editor tests and offscreen previews. */
export function editorPreviewFixture() {
  const looks = parseSettingsDocument({
    name: 'looks',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llsettings.looks',
      schemaVersion: 1,
      current: STYLE_ID,
      looks: [
        {
          id: STYLE_ID,
          name: '기본',
          screens: {
            [STARTER_SCREEN_IDS.main]: {
              layers: {slide: true, media: true},
              lyricStyle: STYLE_ID,
            },
            [STARTER_SCREEN_IDS.stage]: {
              layers: {slide: true},
              lyricStyle: STYLE_ID,
            },
            [STARTER_SCREEN_IDS.broadcast]: {
              layers: {slide: true},
              lyricStyle: STYLE_ID,
            },
          },
        },
      ],
      lyricStyles: [{...DEFAULT_LYRIC_STYLE, id: STYLE_ID, name: '기본 가사'}],
    },
  });
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
        kind: role === 'stage' ? 'stage' : 'audience',
        method: role === 'broadcast' ? 'capture' : 'fullscreen',
      })),
    },
  });
  if (
    !looks.ok ||
    looks.value.name !== 'looks' ||
    !screens.ok ||
    screens.value.name !== 'screens'
  ) {
    throw new Error('Invalid preview fixture');
  }
  return {looks: looks.value, screens: screens.value};
}
