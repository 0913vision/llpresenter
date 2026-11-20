import {app, dialog, ipcMain} from 'electron';
import {open, unlink, mkdtemp, rm, stat, copyFile} from 'node:fs/promises';
import {constants as fsConstants} from 'node:fs';
import {basename, dirname, extname, join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {powerpointEndpoints} from '@contracts/ipc/powerpoint';
import {
  parsePowerPointDecorationBatchRequest,
  parsePowerPointBackgroundRequest,
  parsePowerPointReleaseRequest,
  parsePowerPointReadResult,
  parsePowerPointLayersRequest,
  parsePowerPointScene,
  parsePowerPointOwnedImagesRequest,
  type PowerPointReadResult,
  type PowerPointSource,
} from '@core/schema/powerpointImport';
import type {TextImportRegistration} from './register';
import {TEST_IMPORT_FILE_VARIABLE} from './testImportFile';
import {PowerPointJobs} from './powerpointJob';
import type {MediaStore} from '../store/mediaStore';
import {createMediaId} from '@core/schema/ids';
import {boundedPowerPointImage} from './powerpointImage';
import {POWERPOINT_BACKGROUND_LIMITS} from '@core/songs/powerpointLayers';
import {
  PowerPointImagesJob,
  type PowerPointImagesResult,
} from './powerpointImages';

import {pickerFolder, rememberPickerFile} from './pickerFolder';

const MAX_TEMP_FILES = 2;

async function exportDecorations(
  jobs: Pick<PowerPointImagesJob, 'run'>,
  {
    path,
    directory,
    number,
    stopped,
  }: {
    readonly path: string;
    readonly directory: string;
    readonly number: number;
    readonly stopped: () => boolean;
  },
): Promise<PowerPointImagesResult> {
  let result: PowerPointImagesResult = 'file';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (stopped()) return 'cancelled';
    result = await jobs.run(
      path,
      directory,
      Object.assign(() => undefined, {decorationSlide: number}),
    );
    if (result === 'ok' || result === 'unavailable' || result === 'cancelled') {
      return result;
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return result;
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
  const cm = (size: number): string => (size / 360000).toFixed(2);
  return `16:9만 가능 (${cm(value.width)}×${cm(value.height)}cm)`;
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
  imageJobs: Pick<
    PowerPointImagesJob,
    'run' | 'cancel'
  > = new PowerPointImagesJob(),
): () => void {
  let retained: {
    path: string;
    digest: string;
    source: PowerPointSource;
  } | null = null;
  let busy = false;
  let readCancelled = false;
  const isReadCancelled = (): boolean => readCancelled;
  let drawingBusy = false;
  let drawingFinished: Promise<void> = Promise.resolve();
  let disposed = false;
  const isDisposed = (): boolean => disposed;
  const tempFiles = new Set<string>();
  const extracting = new Set<string>();
  let imagesBusy = false;
  let imagesCancelled = false;
  const isImagesCancelled = (): boolean => imagesCancelled;
  const imageDirectories = new Set<string>();
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
      const directory = dirname(path);
      if (
        imageDirectories.has(directory) &&
        ![...tempFiles].some(file => dirname(file) === directory)
      ) {
        await rm(directory, {recursive: true, force: true});
        imageDirectories.delete(directory);
      }
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
    return true;
  });
  ipcMain.handle(powerpointEndpoints.images.channel, async event => {
    if (imagesBusy || disposed) {
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
          filters: [{name: 'PowerPoint', extensions: ['pptx', 'pptm']}],
        });
        if (chosen.canceled) return {ok: true, value: null};
        path = chosen.filePaths[0];
      }
      if (!path) throw new Error('Missing PowerPoint file');
      if (extname(path).toLowerCase() === '.ppt') {
        return {
          ok: false,
          message:
            'PowerPoint 97-2003 파일은 가져올 수 없습니다. PowerPoint에서 .pptx로 저장한 뒤 가져오십시오.',
        };
      }
      if (!['.pptx', '.pptm'].includes(extname(path).toLowerCase())) {
        throw new Error('Unsupported PowerPoint file');
      }
      const workDirectory = await mkdtemp(
        join(app.getPath('temp'), 'llp-ppt-'),
      );
      directory = workDirectory;
      const copy = join(
        workDirectory,
        `presentation${extname(path).toLowerCase()}`,
      );
      await copyFile(path, copy, fsConstants.COPYFILE_EXCL);
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
      context.log.warn('could not export PowerPoint images', error);
      return {
        ok: false,
        message:
          failure === 'unavailable'
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
    }
  });
  ipcMain.handle(
    powerpointEndpoints.layers.channel,
    async (_event, value: unknown) => {
      const request = parsePowerPointLayersRequest(value);
      if (!request.ok || !retained || disposed || drawingBusy) return null;
      const current = retained;
      const slide = current.source.slides[request.value.index];
      if (!slide?.background) return null;
      drawingBusy = true;
      let finishDrawing: () => void = () => undefined;
      drawingFinished = new Promise<void>(resolve => {
        finishDrawing = resolve;
      });
      try {
        const result = await jobs.run({
          kind: 'layers',
          path: current.path,
          digest: current.digest,
          number: slide.number,
        });
        const parsed = parsePowerPointScene(result);
        return parsed.ok && !isDisposed() && retained === current
          ? parsed.value
          : null;
      } catch (error) {
        context.log.warn('could not read PowerPoint background layers', error);
        return null;
      } finally {
        drawingBusy = false;
        finishDrawing();
      }
    },
  );
  ipcMain.handle(powerpointEndpoints.cancelRead.channel, () => {
    if (!busy) return false;
    readCancelled = true;
    retained = null;
    jobs.cancel?.('read');
    return true;
  });
  ipcMain.handle(
    powerpointEndpoints.read.channel,
    async (): Promise<PowerPointReadResult> => {
      if (busy) return {ok: false, message: 'PowerPoint 파일을 읽는 중입니다.'};
      busy = true;
      readCancelled = false;
      retained = null;
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
            filters: [{name: 'PowerPoint', extensions: ['pptx', 'pptm']}],
          });
          if (chosen.canceled || isReadCancelled()) {
            return {ok: true, value: null};
          }
          path = chosen.filePaths[0];
          rememberPickerFile(context.uiState, 'powerpointImportFolder', path);
        }
        if (!path) throw new Error('파일을 열 수 없습니다.');
        if (extname(path).toLowerCase() === '.ppt') {
          return {
            ok: false,
            message:
              'PowerPoint 97-2003 파일은 가져올 수 없습니다. PowerPoint에서 .pptx로 저장한 뒤 가져오십시오.',
          };
        }
        if (isReadCancelled()) return {ok: true, value: null};
        const result = await jobs.run({kind: 'read', path});
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
        retained = {path, digest: result.digest, source: parsed.value.value};
        return parsed.value;
      } catch (error) {
        if (isReadCancelled()) return {ok: true, value: null};
        context.log.warn('could not read PowerPoint', error);
        retained = null;
        return {
          ok: false,
          message:
            'PowerPoint 파일이 손상되었거나 암호화되었거나 크기 제한을 넘었습니다.',
        };
      } finally {
        busy = false;
      }
    },
  );
  ipcMain.handle(
    powerpointEndpoints.background.channel,
    async (_event, value: unknown) => {
      const request = parsePowerPointBackgroundRequest(value);
      if (!request.ok || retained === null) return null;
      const part = retained.source.slides[request.value.index]?.background;
      if (!part) return null;
      if (tempFiles.size >= MAX_TEMP_FILES || disposed) return null;
      if (request.value.decoration === true) {
        if (imagesBusy || drawingBusy) return null;
        imagesBusy = true;
        imagesCancelled = false;
        let directory: string | null = null;
        try {
          const current = retained;
          const slide = current.source.slides[request.value.index];
          if (slide === undefined) return null;
          directory = await mkdtemp(join(app.getPath('temp'), 'llp-ppt-'));
          const copy = join(directory, `presentation${extname(current.path)}`);
          await copyFile(current.path, copy, fsConstants.COPYFILE_EXCL);
          await jobs.run({
            kind: 'layers',
            path: copy,
            digest: current.digest,
            number: slide.number,
          });
          if (isDisposed() || isImagesCancelled() || retained !== current) {
            return null;
          }
          const result = await exportDecorations(imageJobs, {
            path: copy,
            directory,
            number: slide.number,
            stopped: () => isDisposed() || isImagesCancelled(),
          });
          if (
            result !== 'ok' ||
            isDisposed() ||
            isImagesCancelled() ||
            retained !== current
          ) {
            context.log.warn(`PowerPoint decoration export: ${result}`);
            return null;
          }
          const path = join(directory, 'llp-ppt-0001.png');
          await stat(path);
          await rm(copy, {force: true});
          tempFiles.add(path);
          imageDirectories.add(directory);
          directory = null;
          return path;
        } catch (error) {
          context.log.warn('could not export PowerPoint decorations', error);
          return null;
        } finally {
          if (directory !== null) {
            await rm(directory, {recursive: true, force: true});
          }
          imagesBusy = false;
        }
      }
      const image = request.value.image;
      if (image && !boundedPowerPointImage(Buffer.from(image.bytes))) {
        return null;
      }
      const extension = image
        ? image.mime === 'image/png'
          ? '.png'
          : '.jpg'
        : extname(part).toLowerCase() || '.png';
      const temp = join(
        app.getPath('temp'),
        `llp-ppt-${randomUUID()}${extension}`,
      );
      tempFiles.add(temp);
      extracting.add(temp);
      let created = false;
      try {
        const file = await open(temp, 'wx');
        created = true;
        try {
          if (image) {
            await file.writeFile(image.bytes);
            await file.sync();
          }
        } finally {
          await file.close();
        }
        if (isDisposed()) throw new Error('PowerPoint import closed');
        const result = image
          ? true
          : await jobs.run({
              kind: 'background',
              path: retained.path,
              digest: retained.digest,
              index: request.value.index,
              target: temp,
            });
        if (result !== true || isDisposed()) {
          throw new Error('PowerPoint extraction failed');
        }
        return temp;
      } catch (error) {
        if (created) await release(temp);
        else tempFiles.delete(temp);
        context.log.warn('could not extract PowerPoint background', error);
        return null;
      } finally {
        extracting.delete(temp);
      }
    },
  );
  ipcMain.handle(
    powerpointEndpoints.decorationBatch.channel,
    async (event, value: unknown) => {
      const request = parsePowerPointDecorationBatchRequest(value);
      if (drawingBusy) await drawingFinished;
      const current = retained;
      if (
        !request.ok ||
        current === null ||
        disposed ||
        imagesBusy ||
        drawingBusy ||
        tempFiles.size > 0
      ) {
        return null;
      }
      const numbers = request.value.indices.flatMap(index => {
        const slide = current.source.slides[index];
        return slide === undefined || slide.background === null
          ? []
          : [slide.number];
      });
      if (
        numbers.length !== request.value.indices.length ||
        new Set(numbers).size !== numbers.length
      ) {
        return null;
      }
      imagesBusy = true;
      imagesCancelled = false;
      let directory: string | null = null;
      try {
        const workDirectory = await mkdtemp(
          join(app.getPath('temp'), 'llp-ppt-'),
        );
        directory = workDirectory;
        const copy = join(
          workDirectory,
          `presentation${extname(current.path)}`,
        );
        await copyFile(current.path, copy, fsConstants.COPYFILE_EXCL);
        const first = numbers[0];
        if (
          first === undefined ||
          isImagesCancelled() ||
          isDisposed() ||
          retained !== current
        ) {
          return null;
        }
        await jobs.run({
          kind: 'layers',
          path: copy,
          digest: current.digest,
          number: first,
        });
        if (isImagesCancelled() || isDisposed() || retained !== current) {
          return null;
        }
        const progress = Object.assign(
          (done: number, total: number) => {
            const index = request.value.indices[done - 1];
            const path = join(
              workDirectory,
              `llp-ppt-${String(done).padStart(4, '0')}.png`,
            );
            if (index === undefined || done < 1 || done > numbers.length) {
              return;
            }
            tempFiles.add(path);
            if (!event.sender.isDestroyed()) {
              event.sender.send(powerpointEndpoints.imageProgress.channel, {
                done,
                total,
                index,
                path,
              });
            }
          },
          {decorationSlides: numbers},
        );
        const result = await imageJobs.run(copy, workDirectory, progress);
        if (
          result !== 'ok' ||
          isImagesCancelled() ||
          isDisposed() ||
          retained !== current
        ) {
          return null;
        }
        const candidates = request.value.indices.map((index, position) => ({
          index,
          path: join(
            workDirectory,
            `llp-ppt-${String(position + 1).padStart(4, '0')}.png`,
          ),
        }));
        const exists = await Promise.all(
          candidates.map(item =>
            stat(item.path).then(
              () => true,
              () => false,
            ),
          ),
        );
        const paths = candidates.filter((_, position) => exists[position]);
        candidates.forEach((candidate, position) => {
          if (!exists[position]) tempFiles.delete(candidate.path);
        });
        await rm(copy, {force: true});
        for (const item of paths) tempFiles.add(item.path);
        if (paths.length > 0) {
          imageDirectories.add(workDirectory);
          directory = null;
        }
        return paths.length > 0 ? paths : null;
      } catch (error) {
        context.log.warn(
          'could not export PowerPoint preview decorations',
          error,
        );
        return null;
      } finally {
        if (directory !== null) {
          tempFiles.forEach(path => {
            if (dirname(path) === directory) tempFiles.delete(path);
          });
          await rm(directory, {recursive: true, force: true});
        }
        imagesBusy = false;
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
      try {
        const file = await open(request.value.path, 'r');
        try {
          const info = await file.stat();
          if (
            info.size <= 0 ||
            info.size > POWERPOINT_BACKGROUND_LIMITS.imageBytes
          ) {
            return null;
          }
          const buffer = Buffer.alloc(info.size + 1);
          const {bytesRead} = await file.read(buffer, 0, buffer.length, 0);
          if (bytesRead !== info.size) {
            return null;
          }
          const bytes = buffer.subarray(0, bytesRead);
          if (
            !tempFiles.has(request.value.path) ||
            isDisposed() ||
            !boundedPowerPointImage(bytes)
          ) {
            return null;
          }
          return {mime: bytes[0] === 137 ? 'image/png' : 'image/jpeg', bytes};
        } finally {
          await file.close();
        }
      } catch (error) {
        context.log.warn('could not read PowerPoint preview image', error);
        return null;
      }
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
    jobs.dispose();
    ipcMain.removeHandler(powerpointEndpoints.read.channel);
    ipcMain.removeHandler(powerpointEndpoints.cancelRead.channel);
    ipcMain.removeHandler(powerpointEndpoints.layers.channel);
    ipcMain.removeHandler(powerpointEndpoints.background.channel);
    ipcMain.removeHandler(powerpointEndpoints.release.channel);
    ipcMain.removeHandler(powerpointEndpoints.previewImage.channel);
    ipcMain.removeHandler(powerpointEndpoints.decorationBatch.channel);
    ipcMain.removeHandler(powerpointEndpoints.match.channel);
    ipcMain.removeHandler(powerpointEndpoints.images.channel);
    ipcMain.removeHandler(powerpointEndpoints.cancelImages.channel);
    ipcMain.removeHandler(powerpointEndpoints.storeImages.channel);
    for (const path of tempFiles) {
      if (!extracting.has(path)) release(path).catch(() => undefined);
    }
    for (const directory of imageDirectories) {
      rm(directory, {recursive: true, force: true}).catch(() => undefined);
    }
  };
}
