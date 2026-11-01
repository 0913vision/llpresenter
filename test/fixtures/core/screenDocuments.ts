import {settingsDocument} from '@fixtures/core/settingsDocument';
import type {SettingsDocument} from '@core/schema/settingsDocuments';

export const MAIN_ID = '00000000-0000-4000-8000-000000000001';
export const CAPTIONS_ID = '00000000-0000-4000-8000-000000000002';
export const STAGE_ID = '00000000-0000-4000-8000-000000000003';

/** Builds a valid document for a test, with invented names and ids. */

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
