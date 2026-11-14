import {expect, it} from 'vitest';
import {createDefaultThemes} from '@core/themes/defaults';
import {createScreenId, createThemeId} from '@core/schema/ids';
import {isRecord} from '@core/common/guards';
import {settingsCodecs} from '@main/store/settingsCodecs';
import {isBuiltInThemeId} from '@core/themes/builtInIds';
import oldStage from '@fixtures/core/themes/old-stage.json';

it('persists the order of built-in and user themes across reloads', () => {
  const file = createDefaultThemes();
  const user = {
    id: createThemeId('11111111-1111-4111-8111-111111111111'),
    name: 'User',
    screens: {},
  };
  const ordered = [user, ...file.themes.slice().reverse()];
  const saved = settingsCodecs.themes.serialize(
    {...file, themes: ordered, themeOrder: ordered.map(theme => theme.id)},
    'themes.json',
  );
  expect(saved.ok).toBe(true);
  if (!saved.ok) return;
  const loaded = settingsCodecs.themes.parse(saved.value, 'themes.json');
  expect(loaded.ok).toBe(true);
  if (loaded.ok) {
    expect(loaded.value.data.themes.map(theme => theme.id)).toEqual(
      ordered.map(theme => theme.id),
    );
  }
});

it('rejects duplicate IDs in the persisted theme order', () => {
  const file = createDefaultThemes();
  const id = file.themes[0]?.id;
  if (id === undefined) throw Error('Missing built-in theme');
  const parsed = settingsCodecs.themes.parse(
    JSON.stringify({...file, themeOrder: [id, id]}),
    'themes.json',
  );
  expect(parsed.ok).toBe(false);
});

it('replaces old built-ins and stores only edited built-ins and user themes', () => {
  const defaults = createDefaultThemes();
  const [song, bible] = defaults.themes;
  if (song === undefined || bible === undefined) {
    throw Error('Missing defaults');
  }
  const stageId = createScreenId('00000000-0000-4000-8000-000000000003');
  const oldSong = {...song, screens: {...song.screens, [stageId]: oldStage}};
  const edited = {...bible, edited: true, name: 'Edited theme'};
  const user = {
    ...song,
    id: createThemeId('11111111-1111-4111-8111-111111111111'),
    name: 'User theme',
  };
  const parsed = settingsCodecs.themes.parse(
    JSON.stringify({...defaults, themes: [oldSong, edited, user]}),
    'themes.json',
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  const loaded = parsed.value.data;
  const stage = loaded.themes.find(theme => theme.id === song.id)?.screens[
    stageId
  ];
  expect(
    stage?.elements.some(
      element =>
        'stageSource' in element &&
        (element.stageSource === 'stageItemName' ||
          element.stageSource === 'stagePosition'),
    ),
  ).toBe(false);
  expect(
    stage?.elements.find(element => element.kind === 'clock'),
  ).toMatchObject({seconds: true});
  expect(loaded.themes.find(theme => theme.id === bible.id)).toEqual(edited);
  expect(loaded.themes.find(theme => theme.id === user.id)).toEqual(user);
  const saved = settingsCodecs.themes.serialize(loaded, 'themes.json');
  expect(saved.ok).toBe(true);
  if (!saved.ok) return;
  const disk: unknown = JSON.parse(saved.value);
  if (!isRecord(disk)) {
    throw Error('Invalid saved file');
  }
  expect(disk.standby).toBeUndefined();
  expect(disk.themes).toEqual([edited, user]);
});

it('restores all built-ins alongside a full catalog and saves every user theme', () => {
  const defaults = createDefaultThemes();
  const users = Array.from({length: 200}, (_, index) => ({
    id: createThemeId(
      `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
    ),
    name: `User ${index}`,
    screens: {},
  }));
  const parsed = settingsCodecs.themes.parse(
    JSON.stringify({...defaults, themes: users}),
    'themes.json',
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(defaults.themes.every(theme => isBuiltInThemeId(theme.id))).toBe(true);
  expect(parsed.value.data.themes).toEqual([...defaults.themes, ...users]);
  const serialized = settingsCodecs.themes.serialize(
    parsed.value.data,
    'themes.json',
  );
  expect(serialized.ok).toBe(true);
  if (!serialized.ok) return;
  const disk: unknown = JSON.parse(serialized.value);
  if (!isRecord(disk)) {
    throw Error('Invalid saved file');
  }
  expect(disk.themes).toEqual(users);
});
