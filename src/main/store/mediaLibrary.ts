import {dirname, isAbsolute, resolve} from 'node:path';
import {stat} from 'node:fs/promises';
import type {MediaChoice} from '@core/live/state';
import {mediaLoops} from '@core/media/mediaEndRule';
import type {Result} from '@core/common/result';
import type {FileError} from '@core/schema/fileFormat';
import type {BundledPicture} from './bundledPicture';
import type {MediaItem} from '@core/schema/mediaList';
import {isInside} from './locations';
import {realPathInside} from '../windows/insideRoots';

const LEAVES_MEDIA_FOLDER =
  'Ignored: a relative file path must stay inside the media folder';

/** Where the file of each media item is, and the folders media come from. */
export interface MediaLibrary {
  /** A user media or bundled picture file, or `null` for an unknown ID. */
  fileOf(mediaId: string): string | null;
  /** A playable visual background, or null for a missing or refused file. */
  backgroundOf(mediaId: string): Promise<MediaChoice | null>;
  /**
   * The media folder and the folders of original files referenced outside it.
   * Every file is still resolved by
   * catalogued or bundled ID and checked against these roots after following links.
   */
  readonly roots: readonly string[];
}

export interface MediaLibrarySources {
  readonly items: readonly MediaItem[];
  readonly mediaFolder: string;
  /** `media.json`, for the problems. */
  readonly listFile: string;
  readonly pictures?: readonly BundledPicture[] | undefined;
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
 * data. App-owned pictures resolve independently of the user catalog.
 */
export class LoadingMediaLibrary {
  private library: MediaLibrary = NO_MEDIA;
  private readonly ready: Promise<void>;

  constructor(
    loading: Promise<{readonly media: MediaLibrary} | null>,
    private readonly bundled: ReadonlyArray<{
      readonly id: string;
      readonly file: string;
    }> = [],
  ) {
    this.ready = this.keep(loading);
  }

  /** The file of a media id, once the data is read. */
  readonly findFile = async (mediaId: string): Promise<string | null> => {
    await this.ready;
    return (
      this.bundled.find(picture => picture.id === mediaId)?.file ??
      this.library.fileOf(mediaId) ??
      null
    );
  };

  /** Catalogued media roots plus the explicitly supplied bundled picture roots. */
  readonly roots = (): readonly string[] => [
    ...new Set([
      ...this.library.roots,
      ...this.bundled.map(picture => dirname(picture.file)),
    ]),
  ];

  private async keep(
    loading: Promise<{readonly media: MediaLibrary} | null>,
  ): Promise<void> {
    this.library = (await loading)?.media ?? NO_MEDIA;
  }
}

/**
 * Finds the file of every media item: a relative `file` lies in the media
 * folder, and an absolute one stays where it is (spec 02, "Media list"). A
 * relative path that leaves the media folder is refused. Absolute original
 * references work in development and packaged runs alike. The serving side
 * still checks every real path against `roots`.
 */
export function buildMediaLibrary({
  items,
  mediaFolder,
  listFile,
  pictures = [],
}: MediaLibrarySources): MediaLibraryRead {
  const files = new Map<string, string>();
  const choices = new Map<string, MediaChoice>();
  const roots = new Set([resolve(mediaFolder)]);
  const problems: FileError[] = [];
  items.forEach((item, index) => {
    const placed = placeFile(item.file, mediaFolder);
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
  for (const picture of pictures) {
    files.set(picture.id, picture.file);
    choices.set(picture.id, {mediaId: picture.id, loop: false});
    roots.add(dirname(picture.file));
  }
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

function placeFile(file: string, mediaFolder: string): Result<string, string> {
  const path = resolve(mediaFolder, file);
  if (isInside(path, mediaFolder)) {
    return {ok: true, value: path};
  }
  if (!isAbsolute(file)) {
    return {ok: false, error: LEAVES_MEDIA_FOLDER};
  }
  return {ok: true, value: path};
}
