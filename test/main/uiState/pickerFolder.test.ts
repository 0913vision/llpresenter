import {mkdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {makeTempDir} from '@fixtures/tempDir';
import type {
  UiFields,
  UiStateFields,
} from '@main/store/locations/appConfigFile';
import {pickerFolder, rememberPickerFile} from '@main/uiState/pickerFolder';

vi.mock('electron', () => ({app: {getPath: () => 'documents-fallback'}}));

function uiState(): UiStateFields {
  let fields: UiFields = {};
  return {
    read: () => fields,
    change: next => {
      fields = {...fields, ...next};
    },
  };
}

it('keeps a folder for each picker, keeps it on a cancel, and falls back to Documents for a folder that is gone', async () => {
  const root = await makeTempDir();
  const text = join(root, 'text');
  const media = join(root, 'media');
  await mkdir(text);
  await mkdir(media);
  const state = uiState();
  expect(await pickerFolder(state, 'textImportFolder')).toBe(
    'documents-fallback',
  );
  rememberPickerFile(state, 'textImportFolder', join(text, 'song.txt'));
  rememberPickerFile(state, 'mediaImportFolder', join(media, 'image.png'));
  rememberPickerFile(state, 'textImportFolder', undefined);
  expect(await pickerFolder(state, 'textImportFolder')).toBe(text);
  expect(await pickerFolder(state, 'mediaImportFolder')).toBe(media);
  expect(await pickerFolder(state, 'powerpointImportFolder')).toBe(
    'documents-fallback',
  );
  await rm(text, {recursive: true});
  expect(await pickerFolder(state, 'textImportFolder')).toBe(
    'documents-fallback',
  );
  expect(await pickerFolder(state, 'mediaImportFolder')).toBe(media);
});

it('answers Documents with no UI state and remembers nothing for a relative file', async () => {
  expect(await pickerFolder(undefined, 'mediaRelinkFolder')).toBe(
    'documents-fallback',
  );
  const state = uiState();
  rememberPickerFile(state, 'mediaRelinkFolder', 'relative/image.png');
  expect(state.read()).toEqual({});
});
