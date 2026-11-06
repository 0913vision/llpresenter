import {describe, expect, it} from 'vitest';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {settingsDefaults} from '@main/store/settingsDefaults';
import {DEFAULT_LABELS} from '@main/store/defaults';

it('starts the label menu with the ordered import labels and colors', () => {
  expect(DEFAULT_LABELS.map(({name, color}) => [name, color])).toEqual([
    ['전주', '#7D8FD6'],
    ['1절', '#5FB8C2'],
    ['2절', '#5FB8C2'],
    ['3절', '#5FB8C2'],
    ['4절', '#5FB8C2'],
    ['프리코러스', '#8FBF7A'],
    ['후렴', '#D6B35F'],
    ['포스트코러스', '#D68F5F'],
    ['브리지', '#A99AE0'],
    ['간주', '#A3A3A3'],
    ['후주', '#7D8FD6'],
  ]);
  expect(DEFAULT_LABELS.every(label => label.key === null)).toBe(true);
});

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
