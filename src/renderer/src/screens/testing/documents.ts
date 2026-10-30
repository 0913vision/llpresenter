import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/settingsDocuments';

export const MAIN_ID = '00000000-0000-4000-8000-000000000001';
export const CAPTIONS_ID = '00000000-0000-4000-8000-000000000002';
export const STAGE_ID = '00000000-0000-4000-8000-000000000003';
export const LOOK_ID = '00000000-0000-4000-8000-0000000000a1';
export const SERMON_LOOK_ID = '00000000-0000-4000-8000-0000000000a2';
export const LAYOUT_ID = '00000000-0000-4000-8000-0000000000b1';
export const WIDE_LAYOUT_ID = '00000000-0000-4000-8000-0000000000b2';

/** Builds a valid document for a test, with invented names and ids. */
export function settingsDocument(
  name: SettingsName,
  value: object,
  revision = 1,
): SettingsDocument {
  const parsed = parseSettingsDocument({
    name,
    revision,
    access: 'editable',
    value: {
      format: `llsettings.${name}`,
      schemaVersion: 1,
      ...value,
    },
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
  return parsed.value;
}

export function screensDocument(revision = 1): SettingsDocument {
  return settingsDocument(
    'screens',
    {
      screens: [
        {
          id: MAIN_ID,
          name: '본 화면',
          kind: 'audience',
          method: 'fullscreen',
          display: {
            id: 2,
            name: 'Projector',
            number: 2,
            bounds: {x: 0, y: 0, width: 1920, height: 1080},
            scaleFactor: 1,
          },
        },
        {
          id: CAPTIONS_ID,
          name: '방송 자막',
          kind: 'audience',
          method: 'capture',
        },
        {id: STAGE_ID, name: '무대 화면', kind: 'stage', method: 'fullscreen'},
      ],
    },
    revision,
  );
}

export function looksDocument(
  revision = 1,
  current = LOOK_ID,
): SettingsDocument {
  return settingsDocument(
    'looks',
    {
      current,
      looks: [
        {
          id: LOOK_ID,
          name: '평상시',
          screens: {[STAGE_ID]: {layers: {}, stageLayout: LAYOUT_ID}},
        },
        {
          id: SERMON_LOOK_ID,
          name: '설교',
          screens: {[STAGE_ID]: {layers: {}, stageLayout: WIDE_LAYOUT_ID}},
        },
      ],
      lyricStyles: [],
    },
    revision,
  );
}

export function stageLayoutsDocument(): SettingsDocument {
  const layout = (id: string, name: string) => ({
    id,
    name,
    width: 1920,
    height: 1080,
    elements: [],
  });
  return settingsDocument('stage-layouts', {
    format: 'llsettings.stage',
    layouts: [
      layout(LAYOUT_ID, '현재와 다음'),
      layout(WIDE_LAYOUT_ID, '하단 자막'),
    ],
  });
}
