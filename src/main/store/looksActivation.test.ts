import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {expect, it, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {DEFAULT_MESSAGE_STYLE} from '@shared/schema/looks';
import {
  parseSettingsDocument,
  parseSettingsEdit,
} from '@shared/schema/settingsDocuments';
import {resolveLocations} from './locations';
import {RecoveryCopies} from './recoveryCopies';
import {Saver} from './saver';
import {settingsLocation} from './settingsFile';
import {loadSettingsArea} from './settingsLoader';
import {SettingsStore} from './settingsStore';
import {documentFiles} from './documentFiles';

const fixture = {
  format: 'llsettings.looks',
  schemaVersion: 1,
  current: '00000000-0000-4000-8000-000000000001',
  looks: [],
  extra: {kept: true},
  lyricStyles: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Test',
      font: 'Test',
      weight: 700,
      size: 84,
      color: '#FFFFFF',
      align: 'center',
      vAlign: 'middle',
      lineHeight: 1.4,
      maxLines: 2,
      margin: 6,
      outline: {on: true, width: 3, color: '#000000'},
      shadow: {
        on: false,
        blur: 8,
        distance: 4,
        angle: 45,
        opacity: 60,
        color: '#000000',
      },
      referencePosition: 'bottomRight',
      extraStyle: 'kept',
    },
  ],
};

it('saves and reloads the active Looks fields through settings', async () => {
  const folder = await makeTempDir();
  const {locations} = resolveLocations(
    {},
    {documents: folder, developmentFolder: folder},
  );
  const location = settingsLocation(locations, 'looks');
  await mkdir(dirname(location.file), {recursive: true});
  const original = JSON.stringify(fixture);
  await writeFile(location.file, original);
  const copies = new RecoveryCopies({
    folder: locations.recovery,
    keep: () => 10,
  });
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: async () => {},
  };
  const saver = new Saver({
    copies,
    reportCopyProblem: problem => {
      throw new Error(problem.message);
    },
  });
  const loaded = await loadSettingsArea('looks', locations, saver);
  expect(loaded.problem).toBeNull();
  const document = loaded.document;
  if (document?.name !== 'looks') throw new Error('Looks not loaded');
  expect(document.value).toMatchObject({
    schemaVersion: 1,
    extra: {kept: true},
    lyricStyles: [
      {outline: {on: true}, shadow: {on: false}, extraStyle: 'kept'},
    ],
  });
  const style = document.value.lyricStyles[0];
  if (style === undefined) throw new Error('Style not loaded');
  const store = new SettingsStore({
    documents: new Map([['looks', document]]),
    problems: [],
    log,
    saving: {
      folder: locations.settings,
      files: documentFiles({saver, copies, log}),
      delayMs: 0,
    },
  });
  const value = {
    ...document.value,
    messageStyles: [
      {...DEFAULT_MESSAGE_STYLE, background: {color: '#112233', opacity: 50}},
    ],
    looks: [
      {
        id: fixture.current,
        name: 'Test',
        screens: {
          '00000000-0000-4000-8000-000000000003': {
            layers: {message: true},
            messageStyle: DEFAULT_MESSAGE_STYLE.id,
          },
        },
      },
    ],
    lyricStyles: [
      {
        ...style,
        outline: {...style.outline, width: 7},
        shadow: {...style.shadow, angle: 120},
        referencePosition: 'hidden' as const,
      },
    ],
  };
  const edit = parseSettingsEdit({
    type: 'settings.update',
    name: 'looks',
    value,
    baseRevision: document.revision,
  });
  if (!edit.ok) throw new Error(edit.error.message);
  expect((await store.apply(edit.value)).ok).toBe(true);
  await store.dispose();
  const disk: unknown = JSON.parse(await readFile(location.file, 'utf8'));
  expect(disk).toMatchObject({
    schemaVersion: 1,
    extra: {kept: true},
    messageStyles: [{background: {color: '#112233', opacity: 50}}],
    looks: [
      {
        screens: {
          '00000000-0000-4000-8000-000000000003': {
            messageStyle: DEFAULT_MESSAGE_STYLE.id,
          },
        },
      },
    ],
    lyricStyles: [
      {
        outline: {width: 7},
        shadow: {angle: 120},
        referencePosition: 'hidden',
        extraStyle: 'kept',
      },
    ],
  });
  expect(
    (await loadSettingsArea('looks', locations, saver)).document?.value,
  ).toEqual(disk);
  expect(
    parseSettingsDocument({
      name: 'looks',
      value: disk,
      access: 'editable',
      revision: 1,
    }).ok,
  ).toBe(true);
});

it('rejects invalid settings without replacing the original file', async () => {
  const folder = await makeTempDir();
  const {locations} = resolveLocations(
    {},
    {documents: folder, developmentFolder: folder},
  );
  const location = settingsLocation(locations, 'looks');
  await mkdir(dirname(location.file), {recursive: true});
  const invalid = {
    ...fixture,
    lyricStyles: [{...fixture.lyricStyles[0], shadow: true}],
  };
  const original = JSON.stringify(invalid);
  await writeFile(location.file, original);
  const saver = new Saver({
    copies: new RecoveryCopies({folder: locations.recovery, keep: () => 1}),
    reportCopyProblem: vi.fn(),
  });
  const loaded = await loadSettingsArea('looks', locations, saver);
  expect(loaded.problem?.error.kind).toBe('invalid');
  expect(await readFile(location.file, 'utf8')).toBe(original);
  expect(
    parseSettingsEdit({
      type: 'settings.update',
      name: 'looks',
      value: invalid,
      baseRevision: 1,
    }).ok,
  ).toBe(false);
});
