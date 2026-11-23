import {THEME_CANVAS} from '@core/schema/screens';
import {randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {copyFile, readFile, rm, stat} from 'node:fs/promises';
import {extname, join} from 'node:path';
import {powerpointBackgroundName} from '@core/media';
import {createMediaId, type MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import type {MediaStore} from '../store/mediaStore';
import {sameImage} from './matchImage';
import {powerPointImageSize} from './powerpointImage';

const ATTEMPTS = 3;

export type PictureStore = Pick<
  MediaStore,
  'get' | 'fileOf' | 'folder' | 'add'
>;

/** The picture of the media list that has the same file. */
async function samePicture(
  media: PictureStore,
  path: string,
): Promise<MediaId | null> {
  const {size} = await stat(path);
  for (const item of media.get().value.items) {
    if (item.kind !== 'image' || item.internal || item.size !== size) continue;
    const file = media.fileOf(item.id);
    if (file !== null && (await sameImage(path, file))) return item.id;
  }
  return null;
}

async function pixelsOf(
  path: string,
): Promise<{readonly width: number; readonly height: number}> {
  const size = powerPointImageSize(await readFile(path));
  if (size === null) throw new Error('Not a picture that can be shown');
  return size;
}

/** Copies pictures into the media list, in one change of it. */
async function addPictures(
  media: PictureStore,
  pictures: ReadonlyArray<{
    readonly path: string;
    readonly item: Pick<MediaItem, 'name' | 'internal' | 'width' | 'height'>;
  }>,
): Promise<readonly MediaId[]> {
  if (pictures.length === 0) return [];
  const created: string[] = [];
  let applied = false;
  try {
    const copies = await Promise.allSettled(
      pictures.map(async ({path, item}) => {
        const id = createMediaId(randomUUID());
        const file = `llp-ppt-${id}${extname(path).toLowerCase()}`;
        const target = join(media.folder, file);
        await copyFile(path, target, constants.COPYFILE_EXCL);
        created.push(target);
        const {size} = await stat(target);
        return {...item, id, kind: 'image' as const, file, size};
      }),
    );
    const items = copies.flatMap(result =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    if (items.length !== pictures.length) throw new Error('Copy failed');
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const result = await media.add(
        {items, baseRevision: media.get().revision},
        null,
      );
      if (result.ok) {
        applied = true;
        return items.map(item => item.id);
      }
      if (result.error.reason === 'write-failed') {
        applied = true;
        throw new Error('Media save failed');
      }
      if (result.error.reason !== 'stale') {
        throw new Error(result.error.message);
      }
    }
    throw new Error('Media changed while importing');
  } finally {
    if (!applied) {
      await Promise.all(created.map(path => rm(path, {force: true})));
    }
  }
}

/** Keeps pictures that only the slides made of them use. */
export async function storeSlidePictures(
  media: PictureStore,
  paths: readonly string[],
): Promise<readonly MediaId[]> {
  return addPictures(
    media,
    paths.map(path => ({
      path,
      item: {name: '', internal: true as const, ...THEME_CANVAS},
    })),
  );
}

async function findSame(
  path: string,
  among: readonly string[],
): Promise<string | undefined> {
  for (const other of among) if (await sameImage(path, other)) return other;
  return undefined;
}

/**
 * The media of backgrounds: a picture that the list has already, or a new one
 * named after the song.
 */
export async function storeBackgrounds(
  media: PictureStore,
  paths: readonly string[],
  title: string,
): Promise<readonly MediaId[]> {
  const ids = new Map<string, MediaId>();
  const same = new Map<string, string>();
  const missing: string[] = [];
  for (const path of paths) {
    const id = await samePicture(media, path);
    if (id !== null) {
      ids.set(path, id);
      continue;
    }
    const earlier = await findSame(path, missing);
    if (earlier === undefined) missing.push(path);
    else same.set(path, earlier);
  }
  const names = media.get().value.items.map(item => item.name);
  const pictures = await Promise.all(
    missing.map(async path => ({path, size: await pixelsOf(path)})),
  );
  const added = await addPictures(
    media,
    pictures.map(({path, size}) => {
      const name = powerpointBackgroundName(title, names);
      names.push(name);
      return {path, item: {name, ...size}};
    }),
  );
  for (const [index, id] of added.entries()) {
    const path = missing[index];
    if (path !== undefined) ids.set(path, id);
  }
  return paths.flatMap(path => ids.get(same.get(path) ?? path) ?? []);
}
