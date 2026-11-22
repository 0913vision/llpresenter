import {app, dialog, ipcMain} from 'electron';
import {copyFile, mkdtemp, readFile, rm, stat, unlink} from 'node:fs/promises';
import {constants as fsConstants, existsSync} from 'node:fs';
import {basename, dirname, extname, join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {powerpointEndpoints} from '@contracts/ipc/powerpoint';
import {
  parsePowerPointBackgroundsRequest,
  parsePowerPointOwnedImagesRequest,
  parsePowerPointReadResult,
  parsePowerPointReleaseRequest,
  POWERPOINT_PICTURE_LIMITS,
  type PowerPointBackgroundsResult,
  type PowerPointReadResult,
  type PowerPointSource,
} from '@core/schema/powerpointImport';
import type {TextImportRegistration} from './register';
import {TEST_IMPORT_FILE_VARIABLE} from './testImportFile';
import {PowerPointJobs} from './powerpointJob';
import type {MediaStore} from '../store/mediaStore';
import {createMediaId} from '@core/schema/ids';
import {boundedPowerPointImage} from './powerpointImage';
import {
  PowerPointImagesJob,
  type PowerPointImagesResult,
} from './powerpointImages';

import {pickerFolder, rememberPickerFile} from './pickerFolder';
import {isPowerPointFourThree} from './powerpointSize';

class PowerPointConversionError extends Error {
  constructor(readonly reason: PowerPointImagesResult) {
    super('PowerPoint conversion failed');
  }
}

/** Convert a private copy, so PowerPoint never opens or locks the original. */
async function convertLegacyPowerPoint(
  original: string,
  {
    directory,
    converter,
    stopped,
  }: {
    readonly directory: string;
    readonly converter: Pick<PowerPointImagesJob, 'run'>;
    readonly stopped: () => boolean;
  },
): Promise<string> {
  const copy = join(directory, 'original.ppt');
  await copyFile(original, copy, fsConstants.COPYFILE_EXCL);
  if (stopped()) throw new PowerPointConversionError('cancelled');
  const result = await converter.run(
    copy,
    directory,
    Object.assign(() => undefined, {convert: true as const}),
  );
  if (result !== 'ok') throw new PowerPointConversionError(result);
  const converted = join(directory, 'presentation.pptx');
  await stat(converted);
  await rm(copy, {force: true});
  return converted;
}

function conversionMessage(reason: PowerPointImagesResult): string {
  return reason === 'unavailable'
    ? '이 파일을 가져오려면 PowerPoint가 설치되어 있어야 합니다.'
    : reason === 'unresponsive'
      ? 'PowerPoint가 응답하지 않습니다.'
      : 'PowerPoint 파일을 변환할 수 없습니다.';
}

function unsupportedSlideSize(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('widescreen' in value)) {
    throw new Error('Invalid PowerPoint worker result');
  }
  if (value.widescreen === true) return null;
  if (
    value.widescreen !== false ||
    !('width' in value) ||
    typeof value.width !== 'number' ||
    !('height' in value) ||
    typeof value.height !== 'number' ||
    !Number.isFinite(value.width) ||
    !Number.isFinite(value.height) ||
    value.width <= 0 ||
    value.height <= 0
  ) {
    throw new Error('Invalid PowerPoint slide size');
  }
  if (!isPowerPointFourThree(value.width, value.height)) return null;
  return '4:3 파일은 가져올 수 없습니다. PowerPoint에서 16:9로 바꿔 주세요';
}

interface Retained {
  readonly path: string;
  readonly digest: string;
  readonly source: PowerPointSource;
  /** The picture in the file that all of a slide's background is. */
  readonly pictures: ReadonlyArray<string | undefined>;
}

/** The bytes of a picture, unless it is too large to be decoded. */
async function readBoundedPicture(path: string): Promise<Buffer | null> {
  try {
    const info = await stat(path);
    if (info.size <= 0 || info.size > POWERPOINT_PICTURE_LIMITS.bytes) {
      return null;
    }
    const bytes = await readFile(path);
    return boundedPowerPointImage(bytes) ? bytes : null;
  } catch {
    return null;
  }
}

function picturesOf(slides: unknown): ReadonlyArray<string | undefined> {
  return (Array.isArray(slides) ? slides : []).map((slide: unknown) =>
    typeof slide === 'object' &&
    slide !== null &&
    'picture' in slide &&
    typeof slide.picture === 'string'
      ? slide.picture
      : undefined,
  );
}

export function registerPowerPointImport(
  context: TextImportRegistration & {
    readonly media?: Promise<Pick<MediaStore, 'get' | 'fileOf'> | null>;
    readonly ownedMedia?: Promise<Pick<
      MediaStore,
      'get' | 'folder' | 'add'
    > | null>;
  },
  jobs: Pick<PowerPointJobs, 'run' | 'dispose'> &
    Partial<Pick<PowerPointJobs, 'cancel'>> = new PowerPointJobs(),
  imageJobs: Pick<PowerPointImagesJob, 'run' | 'cancel'> & {
    readonly converter?: Pick<PowerPointImagesJob, 'run' | 'cancel'>;
  } = new PowerPointImagesJob(),
): () => void {
  const converter = imageJobs.converter ?? new PowerPointImagesJob();
  let retained: Retained | null = null;
  let busy = false;
  let readCancelled = false;
  const isReadCancelled = (): boolean => readCancelled;
  let disposed = false;
  let retainedDirectory: string | null = null;
  const isDisposed = (): boolean => disposed;
  const tempFiles = new Set<string>();
  let imagesBusy = false;
  let imagesCancelled = false;
  const isImagesCancelled = (): boolean => imagesCancelled;
  const imageDirectories = new Set<string>();
  /** The folder PowerPoint writes pictures in right now. */
  let exporting: string | null = null;
  /** Settles when PowerPoint is out of the way of the next export. */
  let closing: Promise<void> = Promise.resolve();
  const retiredDirectories = new Set<string>();
  const cleanRetired = (): void => {
    if (imagesBusy) return;
    for (const directory of retiredDirectories) {
      retiredDirectories.delete(directory);
      void rm(directory, {recursive: true, force: true}).catch(
        (error: unknown) =>
          context.log.warn('could not remove PowerPoint copy', error),
      );
    }
  };
  const retireRetained = (): boolean => {
    retained = null;
    if (retainedDirectory === null) return false;
    retiredDirectories.add(retainedDirectory);
    retainedDirectory = null;
    cleanRetired();
    return true;
  };
  /** Removes a folder of pictures once nobody needs one of them any more. */
  const removeIfEmpty = async (directory: string): Promise<void> => {
    if (
      directory === exporting ||
      !imageDirectories.has(directory) ||
      [...tempFiles].some(file => dirname(file) === directory)
    ) {
      return;
    }
    await rm(directory, {recursive: true, force: true});
    imageDirectories.delete(directory);
  };
  const release = async (path: string): Promise<boolean> => {
    if (!tempFiles.has(path)) return false;
    try {
      await unlink(path).catch((error: unknown) => {
        if (
          !(error instanceof Error) ||
          !('code' in error) ||
          error.code !== 'ENOENT'
        ) {
          throw error;
        }
      });
      tempFiles.delete(path);
      await removeIfEmpty(dirname(path));
      return true;
    } catch (error) {
      context.log.warn('could not remove PowerPoint temporary image', error);
      return false;
    }
  };
  ipcMain.handle(
    powerpointEndpoints.storeImages.channel,
    async (_event, value: unknown) => {
      const parsed = parsePowerPointOwnedImagesRequest(value);
      if (
        !parsed.ok ||
        disposed ||
        new Set(parsed.value.paths).size !== parsed.value.paths.length ||
        !parsed.value.paths.every(path => tempFiles.has(path))
      ) {
        return {ok: false, message: 'PowerPoint 이미지 가져오기 실패'};
      }
      const media = await context.ownedMedia;
      if (!media || isDisposed()) {
        return {ok: false, message: '미디어 저장소를 사용할 수 없습니다'};
      }
      const files = parsed.value.paths.map(path => ({
        path,
        id: createMediaId(randomUUID()),
      }));
      const created: string[] = [];
      let applied = false;
      try {
        const copies = await Promise.allSettled(
          files.map(async ({path, id}) => {
            const name = `llp-ppt-${id}.png`;
            const target = join(media.folder, name);
            await copyFile(path, target, fsConstants.COPYFILE_EXCL);
            created.push(target);
            const info = await stat(target);
            return {
              id,
              name: '',
              kind: 'image' as const,
              internal: true as const,
              file: name,
              size: info.size,
              width: 1920,
              height: 1080,
            };
          }),
        );
        const items = copies.flatMap(result =>
          result.status === 'fulfilled' ? [result.value] : [],
        );
        if (items.length !== files.length) throw new Error('Image copy failed');
        for (let attempt = 0; attempt < 3; attempt++) {
          const result = await media.add(
            {items, baseRevision: media.get().revision},
            null,
          );
          if (result.ok) {
            applied = true;
            return {ok: true, value: files.map(file => file.id)};
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
      } catch (error) {
        context.log.warn('could not store owned PowerPoint images', error);
        if (!applied) {
          await Promise.all(created.map(path => rm(path, {force: true})));
        }
        return {ok: false, message: 'PowerPoint 이미지 가져오기 실패'};
      }
    },
  );
  ipcMain.handle(powerpointEndpoints.cancelImages.channel, () => {
    if (!imagesBusy) return false;
    imagesCancelled = true;
    imageJobs.cancel();
    converter.cancel();
    return true;
  });
  ipcMain.handle(powerpointEndpoints.images.channel, async event => {
    await closing;
    if (imagesBusy || busy || disposed) {
      return {ok: false, message: 'PowerPoint 파일을 읽는 중입니다.'};
    }
    imagesBusy = true;
    imagesCancelled = false;
    let directory: string | null = null;
    let failure: PowerPointImagesResult = 'file';
    try {
      let path: string | undefined;
      if (context.windowMode === 'offscreen') {
        path = process.env[TEST_IMPORT_FILE_VARIABLE];
      } else {
        const chosen = await dialog.showOpenDialog(context.control, {
          properties: ['openFile'],
          filters: [{name: 'PowerPoint', extensions: ['pptx', 'pptm', 'ppt']}],
        });
        if (chosen.canceled) return {ok: true, value: null};
        path = chosen.filePaths[0];
      }
      if (!path) throw new Error('Missing PowerPoint file');
      if (!['.pptx', '.pptm', '.ppt'].includes(extname(path).toLowerCase())) {
        throw new Error('Unsupported PowerPoint file');
      }
      const workDirectory = await mkdtemp(
        join(app.getPath('temp'), 'llp-ppt-'),
      );
      directory = workDirectory;
      const copy =
        extname(path).toLowerCase() === '.ppt'
          ? await convertLegacyPowerPoint(path, {
              directory: workDirectory,
              converter,
              stopped: () => isImagesCancelled() || isDisposed(),
            })
          : join(workDirectory, `presentation${extname(path).toLowerCase()}`);
      if (extname(path).toLowerCase() !== '.ppt') {
        await copyFile(path, copy, fsConstants.COPYFILE_EXCL);
      }
      if (isImagesCancelled() || isDisposed()) return {ok: true, value: null};
      const deck = await jobs.run({kind: 'size', path: copy});
      if (isImagesCancelled() || isDisposed()) return {ok: true, value: null};
      const sizeError = unsupportedSlideSize(deck);
      if (sizeError !== null) return {ok: false, message: sizeError};
      const slides: Array<{path: string; number: number}> = [];
      let expected = 0;
      const result = await imageJobs.run(
        copy,
        workDirectory,
        (done, total, number) => {
          if (
            done !== slides.length + 1 ||
            total > 200 ||
            done > total ||
            number < 1 ||
            (expected !== 0 && total !== expected)
          ) {
            return;
          }
          expected = total;
          slides.push({
            path: join(
              workDirectory,
              `llp-ppt-${String(done).padStart(4, '0')}.png`,
            ),
            number,
          });
          if (!event.sender.isDestroyed()) {
            event.sender.send(powerpointEndpoints.imageProgress.channel, {
              done,
              total,
            });
          }
        },
      );
      await rm(copy, {force: true});
      if (result === 'cancelled' || isImagesCancelled() || isDisposed()) {
        return {ok: true, value: null};
      }
      failure = result === 'ok' ? 'file' : result;
      if (
        result !== 'ok' ||
        slides.length === 0 ||
        slides.length !== expected ||
        isDisposed()
      ) {
        throw new Error('PowerPoint image export failed');
      }
      await Promise.all(slides.map(slide => stat(slide.path)));
      for (const slide of slides) tempFiles.add(slide.path);
      imageDirectories.add(workDirectory);
      directory = null;
      return {ok: true, value: {fileName: basename(path), slides}};
    } catch (error) {
      if (isImagesCancelled() || isDisposed()) return {ok: true, value: null};
      context.log.warn('could not export PowerPoint images', error);
      return {
        ok: false,
        message:
          error instanceof PowerPointConversionError
            ? conversionMessage(error.reason)
            : failure === 'unavailable'
              ? 'PowerPoint가 설치되어 있지 않습니다.'
              : failure === 'unresponsive'
                ? 'PowerPoint가 응답하지 않습니다.'
                : 'PowerPoint 파일을 읽을 수 없습니다.',
      };
    } finally {
      if (directory !== null) {
        await rm(directory, {recursive: true, force: true});
      }
      imagesBusy = false;
      cleanRetired();
    }
  });
  ipcMain.handle(powerpointEndpoints.cancelRead.channel, () => {
    if (!busy) return retireRetained();
    readCancelled = true;
    retireRetained();
    jobs.cancel?.('read');
    converter.cancel();
    return true;
  });
  ipcMain.handle(
    powerpointEndpoints.read.channel,
    async (): Promise<PowerPointReadResult> => {
      if (busy || imagesBusy) {
        return {ok: false, message: 'PowerPoint 파일을 읽는 중입니다.'};
      }
      busy = true;
      readCancelled = false;
      retireRetained();
      let directory: string | null = null;
      try {
        let path: string | undefined;
        if (context.windowMode === 'offscreen') {
          path = process.env[TEST_IMPORT_FILE_VARIABLE];
        } else {
          const chosen = await dialog.showOpenDialog(context.control, {
            defaultPath: await pickerFolder(
              context.uiState,
              'powerpointImportFolder',
            ),
            properties: ['openFile'],
            filters: [
              {name: 'PowerPoint', extensions: ['pptx', 'pptm', 'ppt']},
            ],
          });
          if (chosen.canceled || isReadCancelled()) {
            return {ok: true, value: null};
          }
          path = chosen.filePaths[0];
          rememberPickerFile(context.uiState, 'powerpointImportFolder', path);
        }
        if (!path) throw new Error('파일을 열 수 없습니다.');
        let importPath = path;
        if (extname(path).toLowerCase() === '.ppt') {
          directory = await mkdtemp(join(app.getPath('temp'), 'llp-ppt-'));
          importPath = await convertLegacyPowerPoint(path, {
            directory,
            converter,
            stopped: () => isReadCancelled() || isDisposed(),
          });
        }
        if (isReadCancelled()) return {ok: true, value: null};
        const result = await jobs.run({kind: 'read', path: importPath});
        if (isReadCancelled()) return {ok: true, value: null};
        const sizeError = unsupportedSlideSize(result);
        if (sizeError !== null) {
          retained = null;
          return {ok: false, message: sizeError};
        }
        if (
          disposed ||
          typeof result !== 'object' ||
          result === null ||
          !('digest' in result) ||
          typeof result.digest !== 'string' ||
          !/^[a-f0-9]{64}$/.test(result.digest) ||
          !('slides' in result)
        ) {
          throw new Error('Invalid PowerPoint worker result');
        }
        const parsed = parsePowerPointReadResult({
          ok: true,
          value: {
            fileName: basename(path),
            slides: result.slides,
            widescreen: 'widescreen' in result ? result.widescreen : undefined,
          },
        });
        if (!parsed.ok || !parsed.value.ok || parsed.value.value === null) {
          throw new Error('Invalid PowerPoint worker result');
        }
        retained = {
          path: importPath,
          digest: result.digest,
          source: parsed.value.value,
          pictures: picturesOf(result.slides),
        };
        retainedDirectory = directory;
        directory = null;
        return parsed.value;
      } catch (error) {
        if (isReadCancelled() || isDisposed()) return {ok: true, value: null};
        context.log.warn('could not read PowerPoint', error);
        retained = null;
        return {
          ok: false,
          message:
            error instanceof PowerPointConversionError
              ? conversionMessage(error.reason)
              : 'PowerPoint 파일이 손상되었거나 암호화되었거나 크기 제한을 넘었습니다.',
        };
      } finally {
        if (directory !== null) {
          await rm(directory, {recursive: true, force: true});
        }
        busy = false;
      }
    },
  );
  /** Writes the pictures in the file that all of a background is. */
  const writePictures = async (
    current: Retained,
    directory: string,
    wanted: readonly number[],
  ): Promise<ReadonlyMap<number, string>> => {
    const found = wanted.flatMap(index => {
      const part = current.pictures[index];
      return part === undefined ? [] : [{index, part}];
    });
    const files = new Map<number, string>();
    const pictures = found.map(({index, part}) => {
      const target = join(
        directory,
        `llp-ppt-picture-${index}${extname(part).toLowerCase() || '.png'}`,
      );
      files.set(index, target);
      return {part, target};
    });
    if (pictures.length === 0) return files;
    try {
      await jobs.run({
        kind: 'pictures',
        path: current.path,
        digest: current.digest,
        pictures,
      });
    } catch (error) {
      context.log.warn('could not read PowerPoint pictures', error);
      return new Map();
    }
    for (const [index, path] of files) {
      const fits = await readBoundedPicture(path);
      if (fits === null) files.delete(index);
    }
    return files;
  };
  /**
   * Has PowerPoint draw the slides without their texts, one picture each. The
   * pictures are ready before PowerPoint has closed again.
   */
  const exportPictures = async (
    current: Retained,
    directory: string,
    {
      indices,
      onPicture,
    }: {
      readonly indices: readonly number[];
      readonly onPicture: (index: number, path: string) => void;
    },
  ): Promise<{readonly closed: Promise<void>}> => {
    if (indices.length === 0) return {closed: Promise.resolve()};
    const copy = join(directory, `presentation${extname(current.path)}`);
    await copyFile(current.path, copy, fsConstants.COPYFILE_EXCL);
    const decorationSlides = indices.map(
      index => current.source.slides[index]?.number ?? 0,
    );
    let closed = Promise.resolve();
    await new Promise<void>((resolve, reject) => {
      const onDone = (done: number): void => {
        const index = indices[done - 1];
        const name = `llp-ppt-${String(done).padStart(4, '0')}.png`;
        if (index !== undefined) onPicture(index, join(directory, name));
        if (done >= indices.length) resolve();
      };
      closed = imageJobs
        .run(copy, directory, Object.assign(onDone, {decorationSlides}))
        .then(result => {
          if (result === 'ok') return;
          context.log.warn(`PowerPoint background export: ${result}`);
        });
      closed.then(resolve, reject);
    });
    return {closed};
  };
  ipcMain.handle(
    powerpointEndpoints.backgrounds.channel,
    async (event, value: unknown): Promise<PowerPointBackgroundsResult> => {
      await closing;
      const request = parsePowerPointBackgroundsRequest(value);
      const current = retained;
      if (!request.ok || current === null || disposed || imagesBusy) {
        return null;
      }
      const {indices} = request.value;
      if (indices.some(index => current.source.slides[index] === undefined)) {
        return null;
      }
      imagesBusy = true;
      imagesCancelled = false;
      const stopped = (): boolean =>
        isImagesCancelled() || isDisposed() || retained !== current;
      const directory = await mkdtemp(join(app.getPath('temp'), 'llp-ppt-'));
      exporting = directory;
      const files = new Map<number, string>();
      const onPicture = (index: number, path: string): void => {
        if (stopped() || event.sender.isDestroyed() || !existsSync(path)) {
          return;
        }
        tempFiles.add(path);
        files.set(index, path);
        event.sender.send(powerpointEndpoints.imageProgress.channel, {
          done: files.size,
          total: indices.length,
          picture: {index, path},
        });
      };
      imageDirectories.add(directory);
      let closed = Promise.resolve();
      try {
        const plain = await writePictures(current, directory, indices);
        for (const [index, path] of plain) onPicture(index, path);
        if (!stopped()) {
          ({closed} = await exportPictures(current, directory, {
            indices: indices.filter(index => !files.has(index)),
            onPicture,
          }));
        }
        return stopped() || files.size === 0
          ? null
          : [...files].map(([index, path]) => ({index, path}));
      } catch (error) {
        context.log.warn('could not export PowerPoint backgrounds', error);
        return null;
      } finally {
        closing = closed
          .catch((error: unknown) =>
            context.log.warn('could not close PowerPoint', error),
          )
          .then(async () => {
            exporting = null;
            await removeIfEmpty(directory);
            imagesBusy = false;
            cleanRetired();
          })
          .catch((error: unknown) =>
            context.log.warn('could not remove PowerPoint pictures', error),
          );
      }
    },
  );
  ipcMain.handle(
    powerpointEndpoints.previewImage.channel,
    async (_event, value: unknown) => {
      const request = parsePowerPointReleaseRequest(value);
      if (!request.ok || disposed || !tempFiles.has(request.value.path)) {
        return null;
      }
      const bytes = await readBoundedPicture(request.value.path);
      return bytes === null ||
        !tempFiles.has(request.value.path) ||
        isDisposed()
        ? null
        : {mime: bytes[0] === 137 ? 'image/png' : 'image/jpeg', bytes};
    },
  );
  ipcMain.handle(
    powerpointEndpoints.release.channel,
    (_event, value: unknown) => {
      const request = parsePowerPointReleaseRequest(value);
      return request.ok ? release(request.value.path) : false;
    },
  );
  ipcMain.handle(
    powerpointEndpoints.match.channel,
    async (_event, value: unknown) => {
      const request = parsePowerPointReleaseRequest(value);
      if (!request.ok || !tempFiles.has(request.value.path) || disposed) {
        return null;
      }
      const media = await context.media;
      if (!media || !tempFiles.has(request.value.path) || isDisposed()) {
        return null;
      }
      const candidates = media.get().value.items.flatMap(item => {
        if (item.kind !== 'image') return [];
        const path = media.fileOf(item.id);
        return path === null ? [] : [{id: item.id, path}];
      });
      const matched = await jobs.run({
        kind: 'match',
        path: request.value.path,
        candidates,
      });
      const candidate = candidates.find(item => item.id === matched);
      return typeof matched === 'string' &&
        media.fileOf(matched) === candidate?.path &&
        media
          .get()
          .value.items.some(
            item => item.id === matched && item.kind === 'image',
          )
        ? createMediaId(matched)
        : null;
    },
  );
  return () => {
    if (disposed) return;
    disposed = true;
    imageJobs.cancel();
    converter.cancel();
    jobs.dispose();
    ipcMain.removeHandler(powerpointEndpoints.read.channel);
    ipcMain.removeHandler(powerpointEndpoints.cancelRead.channel);
    ipcMain.removeHandler(powerpointEndpoints.backgrounds.channel);
    ipcMain.removeHandler(powerpointEndpoints.release.channel);
    ipcMain.removeHandler(powerpointEndpoints.previewImage.channel);
    ipcMain.removeHandler(powerpointEndpoints.match.channel);
    ipcMain.removeHandler(powerpointEndpoints.images.channel);
    ipcMain.removeHandler(powerpointEndpoints.cancelImages.channel);
    ipcMain.removeHandler(powerpointEndpoints.storeImages.channel);
    for (const path of tempFiles) {
      release(path).catch(() => undefined);
    }
    for (const directory of imageDirectories) {
      rm(directory, {recursive: true, force: true}).catch(() => undefined);
    }
    retireRetained();
  };
}
