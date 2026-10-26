import {readFile} from 'node:fs/promises';
import {describe, expect, it} from 'vitest';
import {parseScreens} from '@shared/schema/screens';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import {resolveOutputScreen, STARTER_SCREEN_IDS} from '@shared/screens';
import {makeTempDir} from '../../../test/temp-dir';
import {resolveLocations} from './locations';
import {RecoveryCopies} from './recoveryCopies';
import {Saver} from './saver';
import {settingsDefaults} from './settingsDefaults';
import {settingsLocation} from './settingsFile';
import {loadSettingsArea} from './settingsLoader';
import {writeJson} from './testFiles';

async function setup() {
  const folder = await makeTempDir();
  const {locations} = resolveLocations(
    {},
    {documents: folder, developmentFolder: folder},
  );
  const saver = new Saver({
    copies: new RecoveryCopies({folder: locations.recovery, keep: () => 1}),
    reportCopyProblem: error => {
      throw new Error(error.message);
    },
  });
  return {locations, saver, file: settingsLocation(locations, 'screens').file};
}

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
  it('creates stable screen UUIDs and method-specific always-on-top values on a new install', async () => {
    const {locations, saver, file} = await setup();
    const loaded = await loadSettingsArea('screens', locations, saver);
    expect(loaded.problem).toBeNull();
    const parsed = parseScreens(await readFile(file, 'utf8'), file);
    if (!parsed.ok) throw new Error(parsed.error.message);
    const screens = parsed.value.data.screens;
    expect(screens.map(screen => screen.id)).toEqual([
      STARTER_SCREEN_IDS.main,
      STARTER_SCREEN_IDS.broadcast,
      STARTER_SCREEN_IDS.stage,
    ]);
    expect(
      screens.map(({method, alwaysOnTop}) => ({method, alwaysOnTop})),
    ).toEqual([
      {method: 'fullscreen', alwaysOnTop: true},
      {method: 'capture', alwaysOnTop: false},
      {method: 'fullscreen', alwaysOnTop: true},
    ]);
    for (const role of ['main', 'broadcast', 'stage'] as const) {
      expect(resolveOutputScreen(role, screens)?.id).toBe(
        STARTER_SCREEN_IDS[role],
      );
    }
    expect(
      (await loadSettingsArea('screens', locations, saver)).document,
    ).toEqual(loaded.document);
  });

  it('uses the same starter identities in default Look references', () => {
    const parsed = parseSettingsDocument({
      name: 'looks',
      value: {
        format: 'llsettings.looks',
        schemaVersion: 1,
        ...settingsDefaults.looks,
      },
      access: 'editable',
      revision: 1,
    });
    if (!parsed.ok || parsed.value.name !== 'looks') {
      throw new Error('Invalid default Look');
    }
    expect(
      Object.keys(parsed.value.value.looks[0]?.screens ?? {}).sort(),
    ).toEqual(Object.values(STARTER_SCREEN_IDS).sort());
  });

  it('keeps existing custom IDs, names, explicit values and absent optional fields unchanged', async () => {
    const {locations, saver, file} = await setup();
    const original = JSON.stringify({
      format: 'llsettings.screens',
      schemaVersion: 1,
      screens: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Renamed capture',
          kind: 'audience',
          method: 'capture',
          alwaysOnTop: true,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Renamed fullscreen',
          kind: 'stage',
          method: 'fullscreen',
          alwaysOnTop: false,
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Renamed window',
          kind: 'audience',
          method: 'window',
          alwaysOnTop: true,
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          name: 'Unspecified',
          kind: 'audience',
          method: 'capture',
        },
      ],
    });
    await writeJson(file, original);
    const loaded = await loadSettingsArea('screens', locations, saver);
    expect(loaded.problem).toBeNull();
    expect(loaded.document?.value).toEqual(JSON.parse(original));
    expect(await readFile(file, 'utf8')).toBe(original);
  });
});
