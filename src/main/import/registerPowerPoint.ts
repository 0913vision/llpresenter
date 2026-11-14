import {app, dialog, ipcMain} from 'electron';
import {open, unlink} from 'node:fs/promises';
import {basename, extname, join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {powerpointEndpoints} from '@contracts/ipc/powerpoint';
import {
  parsePowerPointBackgroundRequest,
  parsePowerPointReleaseRequest,
  parsePowerPointReadResult,
  parsePowerPointLayersRequest,
  parsePowerPointScene,
  type PowerPointReadResult,
  type PowerPointSource,
} from '@core/schema/powerpointImport';
import type {TextImportRegistration} from './register';
import {TEST_IMPORT_FILE_VARIABLE} from './testImportFile';
import {PowerPointJobs} from './powerpointJob';
import type {MediaStore} from '../store/mediaStore';
import {createMediaId} from '@core/schema/ids';
import {boundedPowerPointImage} from './powerpointImage';
import {pickerFolder, rememberPickerFile} from './pickerFolder';

const MAX_TEMP_FILES = 2;

export function registerPowerPointImport(
  context: TextImportRegistration & {
    readonly media?: Promise<Pick<MediaStore, 'get' | 'fileOf'> | null>;
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
      return true;
    } catch (error) {
      context.log.warn('could not remove PowerPoint temporary image', error);
      return false;
    }
  };
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
            defaultPath: await pickerFolder(
              context.uiState,
              'powerpointImportFolder',
            ),
            properties: ['openFile'],
            filters: [{name: 'PowerPoint', extensions: ['pptx', 'pptm']}],
          });
          if (chosen.canceled) return {ok: true, value: null};
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
    jobs.dispose();
    ipcMain.removeHandler(powerpointEndpoints.read.channel);
    ipcMain.removeHandler(powerpointEndpoints.layers.channel);
    ipcMain.removeHandler(powerpointEndpoints.background.channel);
    ipcMain.removeHandler(powerpointEndpoints.release.channel);
    ipcMain.removeHandler(powerpointEndpoints.match.channel);
    for (const path of tempFiles) {
      if (!extracting.has(path)) release(path).catch(() => undefined);
    }
  };
}
