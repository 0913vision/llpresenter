import {describe, expect, it} from 'vitest';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {settingsDefaults} from '@main/store/settingsDefaults';

describe('starter screen defaults', () => {
  it('names translation files with the extension accepted by the Bible loader', () => {
    const parsed = parseSettingsDocument({
      name: 'bible',
      value: {
        format: 'llsettings.bible',
        schemaVersion: 1,
        ...settingsDefaults.bible,
      },
      access: 'editable',
      revision: 1,
    });
    if (!parsed.ok || parsed.value.name !== 'bible') {
      throw new Error('Invalid Bible defaults');
    }
    expect(parsed.value.value.translations.map(({file}) => file)).toEqual([
      'krv.llbible',
      'kjv.llbible',
    ]);
  });
  it('gives the starter screens stable IDs with always-on-top off', () => {
    const parsed = parseSettingsDocument({
      name: 'screens',
      value: {
        format: 'llsettings.screens',
        schemaVersion: 1,
        ...settingsDefaults.screens,
      },
      access: 'editable',
      revision: 1,
    });
    if (!parsed.ok || parsed.value.name !== 'screens') {
      throw new Error('Invalid screen defaults');
    }
    expect(
      parsed.value.value.screens.map(({id, method, alwaysOnTop}) => ({
        id,
        method,
        alwaysOnTop,
      })),
    ).toEqual([
      {id: STARTER_SCREEN_IDS.main, method: 'fullscreen', alwaysOnTop: false},
      {
        id: STARTER_SCREEN_IDS.broadcast,
        method: 'capture',
        alwaysOnTop: false,
      },
      {id: STARTER_SCREEN_IDS.stage, method: 'fullscreen', alwaysOnTop: false},
    ]);
  });
});
