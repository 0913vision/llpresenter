import {mkdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {makeTempDir} from '@fixtures/tempDir';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {openAppConfig} from '@main/store/appConfigFile';
import {pickerFolder, rememberPickerFile} from '@main/import/pickerFolder';

vi.mock('electron', () => ({app: {getPath: () => 'documents-fallback'}}));

it('persists independent picker folders, preserves cancellation, and falls back for missing folders', async () => {
  const root = await makeTempDir();
  const text = join(root, 'text');
  const media = join(root, 'media');
  await mkdir(text);
  await mkdir(media);
  const file = join(root, 'app.json');
  const first = await openAppConfig({file, log: recordingLogger()});
  expect(await pickerFolder(first, 'textImportFolder')).toBe(
    'documents-fallback',
  );
  rememberPickerFile(first, 'textImportFolder', join(text, 'song.txt'));
  rememberPickerFile(first, 'mediaImportFolder', join(media, 'image.png'));
  rememberPickerFile(first, 'textImportFolder', undefined);
  await first.flush();
  first.dispose();
  const reopened = await openAppConfig({file, log: recordingLogger()});
  expect(await pickerFolder(reopened, 'textImportFolder')).toBe(text);
  expect(await pickerFolder(reopened, 'mediaImportFolder')).toBe(media);
  expect(await pickerFolder(reopened, 'powerpointImportFolder')).toBe(
    'documents-fallback',
  );
  await rm(text, {recursive: true});
  expect(await pickerFolder(reopened, 'textImportFolder')).toBe(
    'documents-fallback',
  );
  expect(await pickerFolder(reopened, 'mediaImportFolder')).toBe(media);
  reopened.dispose();
});
