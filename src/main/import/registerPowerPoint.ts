import {app, dialog, ipcMain} from 'electron';
import {open, unlink, mkdtemp, rm, stat, copyFile} from 'node:fs/promises';
import {constants as fsConstants} from 'node:fs';
import {basename, dirname, extname, join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {powerpointEndpoints} from '@contracts/ipc/powerpoint';
import {
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
import {PowerPointImagesJob} from './powerpointImages';

const MAX_TEMP_FILES = 2;

export function registerPowerPointImport(
  context: TextImportRegistration & {
    readonly media?: Promise<Pick<MediaStore, 'get' | 'fileOf'> | null>;
    readonly ownedMedia?: Promise<Pick<
      MediaStore,
      'get' | 'folder' | 'add'
    > | null>;
  },
  jobs: Pick<PowerPointJobs, 'run' | 'dispose'> = new PowerPointJobs(),
): () => void {
  let retained: {
    path: string;
    digest: string;
    source: PowerPointSource;
  } | null = null;
  let busy = false;
  let drawingBusy = false;
  let disposed = false;
  const isDisposed = (): boolean => disposed;
  const tempFiles = new Set<string>();
  const extracting = new Set<string>();
  const imageJobs = new PowerPointImagesJob();
  let imagesBusy = false;
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
    imageJobs.cancel();
    return true;
  });
  ipcMain.handle(powerpointEndpoints.images.channel, async event => {
    if (imagesBusy || disposed) {
      return {ok: false, message: 'PowerPoint 파일을 읽는 중입니다.'};
    }
    imagesBusy = true;
    let directory: string | null = null;
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
      const slides: Array<{path: string; number: number}> = [];
      let expected = 0;
      const ok = await imageJobs.run(
        path,
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
      if (
        !ok ||
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
        message: 'PowerPoint가 있어야 이미지로 가져올 수 있습니다.',
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
      }
    },
  );
  ipcMain.handle(
    powerpointEndpoints.read.channel,
    async (): Promise<PowerPointReadResult> => {
      if (busy) return {ok: false, message: 'PowerPoint 파일을 읽는 중입니다.'};
      busy = true;
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
        if (!path) throw new Error('파일을 열 수 없습니다.');
        if (extname(path).toLowerCase() === '.ppt') {
          return {
            ok: false,
            message:
              'PowerPoint 97-2003 파일은 가져올 수 없습니다. PowerPoint에서 .pptx로 저장한 뒤 가져오십시오.',
          };
        }
        const result = await jobs.run({kind: 'read', path});
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
    ipcMain.removeHandler(powerpointEndpoints.layers.channel);
    ipcMain.removeHandler(powerpointEndpoints.background.channel);
    ipcMain.removeHandler(powerpointEndpoints.release.channel);
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
