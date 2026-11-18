import {expect, it} from 'vitest';
import {
  createDefaultThemes,
  IMAGE_SLIDES_THEME_ID,
} from '@core/themes/defaults';
import {createScreenId, createThemeId} from '@core/schema/ids';
import {isRecord} from '@core/common/guards';
import {settingsCodecs} from '@main/store/settingsCodecs';
import {isBuiltInThemeId} from '@core/themes/builtInIds';
import oldStage from '@fixtures/core/themes/old-stage.json';

it('loads and preserves an old user theme containing stage sources', () => {
  const defaults = createDefaultThemes();
  const base = defaults.themes[0];
  if (!base) throw Error('Missing theme');
  const stageId = createScreenId('00000000-0000-4000-8000-000000000003');
  const user = {
    ...base,
    id: createThemeId('11111111-1111-4111-8111-111111111111'),
    name: 'Old user theme',
    screens: {...base.screens, [stageId]: oldStage},
  };
  const loaded = settingsCodecs.themes.parse(
    JSON.stringify({...defaults, themes: [user]}),
    'themes.json',
  );
  expect(loaded.ok).toBe(true);
  if (!loaded.ok) return;
  expect(loaded.value.data.themes.find(theme => theme.id === user.id)).toEqual(
    user,
  );
  const saved = settingsCodecs.themes.serialize(
    loaded.value.data,
    'themes.json',
  );
  expect(saved.ok).toBe(true);
  if (!saved.ok) return;
  const reloaded = settingsCodecs.themes.parse(saved.value, 'themes.json');
  expect(reloaded.ok).toBe(true);
  if (reloaded.ok) {
    expect(
      reloaded.value.data.themes.find(theme => theme.id === user.id),
    ).toEqual(user);
  }
});

it('preserves an edited theme with the former ID without remapping it', () => {
  const file = createDefaultThemes();
  const image = file.themes.find(theme => theme.id === IMAGE_SLIDES_THEME_ID);
  if (image === undefined) throw Error('Missing image theme');
  const old = {
    ...image,
    id: createThemeId('00000000-0000-4000-8000-000000000107'),
    edited: true,
    name: 'Edited image',
  };
  const result = settingsCodecs.themes.parse(
    JSON.stringify({...file, themes: [old]}),
    'themes.json',
  );
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.data.themes.find(theme => theme.id === old.id)).toEqual(
      old,
    );
    expect(
      result.value.data.themes.find(
        theme => theme.id === IMAGE_SLIDES_THEME_ID,
      ),
    ).toEqual(image);
  }
});

it('reads an unedited saved standby as stored and omits it on write', () => {
  const file = createDefaultThemes();
  const standby = {...file.standby, name: 'Saved standby'};
  const loaded = settingsCodecs.themes.parse(
    JSON.stringify({...file, standby, themes: []}),
    'themes.json',
  );
  expect(loaded.ok).toBe(true);
  if (!loaded.ok) return;
  expect(loaded.value.data.standby).toEqual(standby);
  expect(loaded.value.data.themes).toEqual(file.themes);
  const saved = settingsCodecs.themes.serialize(
    loaded.value.data,
    'themes.json',
  );
  expect(saved.ok).toBe(true);
  if (!saved.ok) return;
  const disk: unknown = JSON.parse(saved.value);
  if (!isRecord(disk)) throw Error('Invalid saved file');
  expect(disk.standby).toBeUndefined();
  expect(disk.themes).toEqual([]);
});

it('preserves former IDs in the saved theme order', () => {
  const file = createDefaultThemes();
  const old = createThemeId('00000000-0000-4000-8000-000000000107');
  const order = [old, IMAGE_SLIDES_THEME_ID];
  const result = settingsCodecs.themes.parse(
    JSON.stringify({...file, themeOrder: order}),
    'themes.json',
  );
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.value.data.themeOrder).toEqual(order);
});

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

it('loads saved built-in copies and stores only edited built-ins and user themes', () => {
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
  expect(loaded.themes.find(theme => theme.id === song.id)).toEqual(oldSong);
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
