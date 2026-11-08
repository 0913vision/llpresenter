import {readFile, readdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it, onTestFinished} from 'vitest';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {MEDIA_LIMITS} from '@core/schema/mediaList';
import {
  SECTION_BACKGROUNDS,
  SECTION_RULES_ID,
} from '@core/themes/sundaySections';
import {createMediaId} from '@core/schema/ids';
import {MediaStore} from '@main/store/mediaStore';
import {prepareSectionPictures} from '@main/store/prepareSectionPictures';
import {makeTempDir} from '@fixtures/tempDir';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {recordingLogger} from '@fixtures/main/displays/testing';

async function setup(
  replacement = false,
  access: 'editable' | 'readOnly' = 'editable',
  options: {readonly itemCount?: number; readonly failSave?: boolean} = {},
) {
  const folder = await makeTempDir();
  const pictures = await Promise.all(
    [...SECTION_BACKGROUNDS.map(picture => picture.id), SECTION_RULES_ID].map(
      async id => {
        const file = join(folder, `source-${id}.png`);
        await writeFile(file, `shipped-${id}`);
        return {id, name: id, file};
      },
    ),
  );
  await writeFile(join(folder, 'legacy.png'), 'legacy');
  const items = Array.from({length: options.itemCount ?? 1}, (_, index) => ({
    id: createMediaId(
      `00000000-0000-4000-8000-${String(index + 999).padStart(12, '0')}`,
    ),
    name: 'Legacy picture',
    kind: 'image' as const,
    file: 'legacy.png',
    size: 6,
    future: 'preserve',
  }));
  const document = expectSuccess(
    parseMediaDocument({
      name: 'media',
      revision: 1,
      access,
      value: {
        format: 'llmedia',
        schemaVersion: 1,
        items: replacement
          ? [
              ...items,
              {
                id: SECTION_BACKGROUNDS[0].id,
                name: 'Operator replacement',
                kind: 'image',
                file: 'legacy.png',
                size: 6,
                future: 'operator',
              },
            ]
          : items,
        playlists: [],
        audioPlaylists: [],
        future: 'catalog',
      },
    }),
  );
  const store = new MediaStore({
    document,
    file: join(folder, 'media.json'),
    mediaFolder: folder,
    log: recordingLogger(),
    delayMs: 0,
    files: {
      write: async request => {
        if (options.failSave) {
          return {
            ok: false,
            error: {file: request.target.file, message: 'Disk full'},
          };
        }
        await writeFile(request.target.file, request.text);
        return {ok: true, value: undefined};
      },
      remove: async () => ({ok: true, value: undefined}),
    },
  });
  onTestFinished(() => store.dispose());
  return {folder, pictures, store, document};
}

it('prepares missing section backgrounds and rules in an older catalog, once even for concurrent requests', async () => {
  const {folder, pictures, store, document} = await setup();
  const results = await Promise.all([
    prepareSectionPictures(store, pictures),
    prepareSectionPictures(store, pictures),
  ]);
  expect(results.every(result => result.ok)).toBe(true);
  expect(store.get().value.items).toHaveLength(9);
  expect(store.get().value.items[0]).toEqual(document.value.items[0]);
  expect(store.get().value).toMatchObject({future: 'catalog'});
  for (const picture of pictures) {
    const item = store.get().value.items.find(item => item.id === picture.id);
    expect(item).toMatchObject({kind: 'image', width: 1920, height: 1080});
    if (item === undefined) throw Error('Missing picture');
    expect(await readFile(join(folder, item.file), 'utf8')).toBe(
      `shipped-${picture.id}`,
    );
  }
  const revision = store.get().revision;
  await expect(prepareSectionPictures(store, pictures)).resolves.toEqual({
    ok: true,
    value: null,
  });
  expect(store.get().revision).toBe(revision);
});

it('preserves operator replacements and existing disk files while adding only absent IDs', async () => {
  const {folder, pictures, store, document} = await setup(true);
  const collision = `${SECTION_BACKGROUNDS[1].id}.png`;
  await writeFile(join(folder, collision), 'operator loose file');
  expect((await prepareSectionPictures(store, pictures)).ok).toBe(true);
  expect(
    store.get().value.items.find(item => item.id === SECTION_BACKGROUNDS[0].id),
  ).toEqual(document.value.items[1]);
  expect(await readFile(join(folder, 'legacy.png'), 'utf8')).toBe('legacy');
  expect(await readFile(join(folder, collision), 'utf8')).toBe(
    'operator loose file',
  );
  expect(
    store.get().value.items.find(item => item.id === SECTION_BACKGROUNDS[1].id)
      ?.file,
  ).not.toBe(collision);
});

it('refuses an older read-only catalog instead of inserting unresolved picture IDs', async () => {
  const {pictures, store} = await setup(false, 'readOnly');
  expect(await prepareSectionPictures(store, pictures)).toMatchObject({
    ok: false,
    error: {reason: 'read-only'},
  });
  expect(store.get().value.items).toHaveLength(1);
});

it('removes only newly copied files after a partial-copy failure, including repeated attempts', async () => {
  const {folder, pictures, store, document} = await setup(true);
  const collision = `${SECTION_BACKGROUNDS[1].id}.png`;
  await writeFile(join(folder, collision), 'operator loose file');
  const before = (await readdir(folder)).sort();
  const broken = pictures.map((picture, index) =>
    index === 2
      ? {...picture, file: join(folder, 'missing-source.png')}
      : picture,
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    await expect(prepareSectionPictures(store, broken)).rejects.toThrow();
    expect((await readdir(folder)).sort()).toEqual(before);
    expect(store.get()).toEqual(document);
    expect(await readFile(join(folder, collision), 'utf8')).toBe(
      'operator loose file',
    );
    expect(await readFile(join(folder, 'legacy.png'), 'utf8')).toBe('legacy');
  }
  expect((await prepareSectionPictures(store, pictures)).ok).toBe(true);
});

it('removes uncommitted copies when the full catalog rejects insertion without accumulating retry files', async () => {
  const {folder, pictures, store, document} = await setup(false, 'editable', {
    itemCount: MEDIA_LIMITS.items,
  });
  const before = (await readdir(folder)).sort();
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(await prepareSectionPictures(store, pictures)).toMatchObject({
      ok: false,
      error: {reason: 'invalid'},
    });
    expect(store.get()).toEqual(document);
    expect((await readdir(folder)).sort()).toEqual(before);
  }
});

it('keeps applied picture files when saving the catalog fails', async () => {
  const {folder, pictures, store} = await setup(false, 'editable', {
    failSave: true,
  });
  expect(await prepareSectionPictures(store, pictures)).toMatchObject({
    ok: false,
    error: {reason: 'write-failed', applied: {revision: 2}},
  });
  for (const picture of pictures) {
    const item = store.get().value.items.find(item => item.id === picture.id);
    if (item === undefined) throw Error('Missing applied picture');
    expect(await readFile(join(folder, item.file), 'utf8')).toBe(
      `shipped-${picture.id}`,
    );
  }
  const before = (await readdir(folder)).sort();
  await expect(prepareSectionPictures(store, pictures)).resolves.toEqual({
    ok: true,
    value: null,
  });
  expect((await readdir(folder)).sort()).toEqual(before);
});
