import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {build} from 'vite';
import {describe, expect, it} from 'vitest';
import {parseMediaList} from '@core/schema/mediaList';
import {parseRecoveryRecord} from '@core/schema/recoveryRecord';
import {makeTempDir} from '@fixtures/tempDir';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {recoverMediaImports} from '@main/store/mediaImportJournal';
import {openRecoverySession} from '@main/live/recovery/session';
import {RecoveryController} from '@main/live/recovery/controller';
import {LiveStore} from '@main/live/store';
import {overlaySettings} from '@fixtures/core/overlays';
import {recoveryContent} from '@fixtures/main/live/recovery';
import {killProcessTree} from '../../scripts/process-tree.mts';

async function buildWorker(): Promise<string> {
  const folder = await makeTempDir();
  await build({
    configFile: false,
    logLevel: 'silent',
    ssr: {noExternal: true},
    resolve: {
      alias: {'@core': resolve('src/core'), '@main': resolve('src/main')},
    },
    build: {
      ssr: resolve('test/fixtures/main/crashPersistenceWorker.ts'),
      outDir: folder,
      rolldownOptions: {output: {format: 'cjs', entryFileNames: 'worker.cjs'}},
    },
  });
  return join(folder, 'worker.cjs');
}

async function crashAt(mode: string): Promise<string> {
  const folder = await makeTempDir();
  const worker = await buildWorker();
  const child = spawn(process.execPath, [worker, mode, folder], {
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    windowsHide: true,
  });
  const pid = child.pid;
  if (pid === undefined) throw new Error('Fixture process did not start');
  let stderr = '';
  child.stderr?.on('data', (bytes: Buffer) => {
    stderr += bytes.toString();
  });
  try {
    await new Promise<void>((done, fail) => {
      const timer = setTimeout(
        () => fail(new Error(`Fixture timed out: ${stderr}`)),
        20_000,
      );
      child.once('error', error => {
        clearTimeout(timer);
        fail(error);
      });
      child.once('exit', () => {
        clearTimeout(timer);
        fail(new Error(`Fixture exited: ${stderr}`));
      });
      child.once('message', (message: unknown) => {
        clearTimeout(timer);
        if (
          typeof message === 'object' &&
          message !== null &&
          'ready' in message
        ) {
          done();
        } else fail(new Error(JSON.stringify(message)));
      });
    });
    expect(await killProcessTree(pid)).toEqual({ok: true});
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      await killProcessTree(pid);
    }
  }
  return folder;
}

describe('process death at persistence boundaries', () => {
  it.each(['on', 'off'])(
    'restores the committed output %s switch immediately after a kill',
    async mode => {
      const folder = await crashAt(mode);
      const log = recordingLogger();
      const session = await openRecoverySession({folder, log});
      expect(session.crashed).toBe(true);
      const record = parseRecoveryRecord(
        await readFile(join(folder, 'live.json'), 'utf8'),
      );
      expect(record).toMatchObject({
        ok: true,
        value: {
          data: {
            state: {
              outputs: {'00000000-0000-4000-8000-000000000001': mode === 'on'},
            },
          },
        },
      });
      const controller = new RecoveryController({
        crashed: true,
        file: join(folder, 'live.json'),
        store: new LiveStore(),
        sources: Promise.resolve({
          settings: overlaySettings().reader,
          content: recoveryContent(),
        }),
        record: {start: () => undefined},
        showOutputsOnLaunch: async () => undefined,
        runStartupMacros: async () => undefined,
        log,
      });
      expect(Boolean(await controller.summary())).toBe(mode === 'on');
    },
  );

  it.each(['copied', 'registered'])(
    'reconciles a kill after media is %s without deleting registered bytes',
    async mode => {
      const folder = await crashAt(mode);
      const parsed = parseMediaList(
        await readFile(join(folder, 'media.json'), 'utf8'),
        'media.json',
      );
      if (!parsed.ok) throw new Error(parsed.error.message);
      const mediaFolder = join(folder, 'Media');
      expect(await readFile(join(mediaFolder, 'source.png'), 'utf8')).toBe(
        'fixture image bytes',
      );
      await recoverMediaImports(
        mediaFolder,
        parsed.value.data,
        recordingLogger(),
      );
      if (mode === 'registered') {
        expect(parsed.value.data.items).toHaveLength(1);
        expect(await readFile(join(mediaFolder, 'source.png'), 'utf8')).toBe(
          'fixture image bytes',
        );
      } else {
        expect(parsed.value.data.items).toHaveLength(0);
        await expect(
          readFile(join(mediaFolder, 'source.png')),
        ).rejects.toMatchObject({code: 'ENOENT'});
      }
    },
  );
});
