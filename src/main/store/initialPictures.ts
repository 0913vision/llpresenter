import {copyFile, stat, mkdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {basename} from 'node:path';
import type {MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {freePath} from '../media/copyFile';

export interface InitialPicture {
  readonly id: MediaId;
  readonly name: string;
  readonly file: string;
}

/** Copies shipped pictures into a new library, where operators can replace them. */
export async function initialPictures(
  folder: string,
  pictures: readonly InitialPicture[],
): Promise<readonly MediaItem[]> {
  await mkdir(folder, {recursive: true});
  const items: MediaItem[] = [];
  for (const picture of pictures) {
    const file = await freePath(folder, `${picture.id}.png`);
    if (file === null) throw new Error('No free name for a default picture');
    await copyFile(picture.file, file, constants.COPYFILE_EXCL);
    const size = (await stat(file)).size;
    items.push({
      id: picture.id,
      name: picture.name,
      file: basename(file),
      kind: 'image',
      size,
      width: 1920,
      height: 1080,
    });
  }
  return items;
}
