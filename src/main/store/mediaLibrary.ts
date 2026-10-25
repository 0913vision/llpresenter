import {dirname, isAbsolute, resolve} from 'node:path';
import {stat} from 'node:fs/promises';
import type {MediaChoice} from '@shared/live';
import {mediaLoops} from '@shared/mediaEndRule';
import type {Result} from '@shared/result';
import type {FileError} from '@shared/schema/fileFormat';
import type {MediaItem} from '@shared/schema/mediaList';
import {isInside} from './locations';
import {realPathInside} from '../windows/insideRoots';

const LEAVES_MEDIA_FOLDER =
  'Ignored: a relative file path must stay inside the media folder';
const OUTSIDE_IN_DEVELOPMENT =
  'Ignored in development: the file is outside the media folder';

/** Where the file of each media item is, and the folders media come from. */
export interface MediaLibrary {
  /** The file of a media id, or `null` when the list has none for it. */
  fileOf(mediaId: string): string | null;
  /** A playable visual background, or null for a missing or refused file. */
  backgroundOf(mediaId: string): Promise<MediaChoice | null>;
  /**
   * The media folder and the folders of media kept outside it. In
   * development, only the media folder, so a development run never serves a
   * file outside `LLP_USER_DATA`.
   */
  readonly roots: readonly string[];
}

export interface MediaLibrarySources {
  readonly items: readonly MediaItem[];
  readonly mediaFolder: string;
  /** The `LLP_USER_DATA` folder in development, or `null`. */
  readonly developmentFolder: string | null;
  /** `media.json`, for the problems. */
  readonly listFile: string;
}

export interface MediaLibraryRead {
  readonly library: MediaLibrary;
  /** Items whose file the library refused. */
  readonly problems: readonly FileError[];
}

/** No media at all, until the data is read. */
export const NO_MEDIA: MediaLibrary = {
  fileOf: () => null,
  backgroundOf: () => Promise.resolve(null),
  roots: [],
};

/**
 * The media library of data that is still being read: a lookup waits for the
 * data, and there are no roots until it is read. Data that couldn't be read
 * has no media.
 */
export class LoadingMediaLibrary {
  private library: MediaLibrary = NO_MEDIA;
  private readonly ready: Promise<void>;

  constructor(loading: Promise<{readonly media: MediaLibrary} | null>) {
    this.ready = this.keep(loading);
  }

  /** The file of a media id, once the data is read. */
  readonly findFile = async (mediaId: string): Promise<string | null> => {
    await this.ready;
    return this.library.fileOf(mediaId);
  };

  /** The folders media come from, or none before the data is read. */
  readonly roots = (): readonly string[] => this.library.roots;

  private async keep(
    loading: Promise<{readonly media: MediaLibrary} | null>,
  ): Promise<void> {
    this.library = (await loading)?.media ?? NO_MEDIA;
  }
}

/**
 * Finds the file of every media item: a relative `file` lies in the media
 * folder, and an absolute one stays where it is (spec 02, "Media list"). A
 * relative path that leaves the media folder is refused, and so is any file
 * outside it in development. The serving side still checks every real path
 * against `roots`.
 */
export function buildMediaLibrary({
  items,
  mediaFolder,
  developmentFolder,
  listFile,
}: MediaLibrarySources): MediaLibraryRead {
  const files = new Map<string, string>();
  const choices = new Map<string, MediaChoice>();
  const roots = new Set([resolve(mediaFolder)]);
  const problems: FileError[] = [];
  items.forEach((item, index) => {
    const placed = placeFile(item.file, mediaFolder, developmentFolder);
    if (!placed.ok) {
      problems.push({
        kind: 'invalid',
        file: listFile,
        field: `items.${index}.file`,
        message: placed.error,
      });
      return;
    }
    files.set(item.id, placed.value);
    if (item.kind !== 'audio') {
      choices.set(item.id, {
        mediaId: item.id,
        loop: mediaLoops(item),
      });
    }
    if (!isInside(placed.value, mediaFolder)) {
      roots.add(dirname(placed.value));
    }
  });
  return {
    library: {
      fileOf: mediaId => files.get(mediaId) ?? null,
      backgroundOf: async mediaId => {
        const choice = choices.get(mediaId);
        const file = files.get(mediaId);
        if (choice === undefined || file === undefined) return null;
        const real = await realPathInside(file, [...roots]);
        if (real === null) return null;
        try {
          return (await stat(real)).isFile() ? choice : null;
        } catch {
          return null;
        }
      },
      roots: [...roots],
    },
    problems,
  };
}

function placeFile(
  file: string,
  mediaFolder: string,
  developmentFolder: string | null,
): Result<string, string> {
  const path = resolve(mediaFolder, file);
  if (isInside(path, mediaFolder)) {
    return {ok: true, value: path};
  }
  if (!isAbsolute(file)) {
    return {ok: false, error: LEAVES_MEDIA_FOLDER};
  }
  return developmentFolder === null
    ? {ok: true, value: path}
    : {ok: false, error: OUTSIDE_IN_DEVELOPMENT};
}
