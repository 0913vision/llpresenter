import {expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {looksDocument} from '@core/testing/screenDocuments';
import type {NamedDocument} from '@renderer/platform/useSettingsDocument';
import {SettingsDocumentEditor} from './settingsDocumentEditor';

it('retains applied revisions but requires disk success for rename completion', async () => {
  const initial = looksDocument();
  if (initial.name !== 'looks') throw Error('Expected Looks');
  let revision = initial.revision;
  const edit = vi.fn<LlpApi['settings']['edit']>().mockImplementation(() =>
    Promise.resolve({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented disk failure',
        applied: {id: 'looks', revision: ++revision},
        unchangedFiles: ['looks.json'],
      },
    }),
  );
  const report = vi.fn();
  const editor = new SettingsDocumentEditor<NamedDocument<'looks'>>(
    mockLlpApi({settings: {edit}}),
    {
      update: (base, value) => ({
        type: 'settings.update',
        name: 'looks',
        value,
        baseRevision: base.revision,
      }),
      report,
      failureTitle: '저장 실패',
      logMessage: 'Could not save Looks',
    },
  );
  editor.adopt(initial);
  expect(
    await editor.change(value => ({...value, future: 'first'}), 'saved'),
  ).toBe(false);
  expect(editor.getSnapshot()?.revision).toBe(2);
  expect(await editor.change(value => ({...value, future: 'second'}))).toBe(
    true,
  );
  expect(edit.mock.calls[1]?.[0]).toMatchObject({baseRevision: 2});
  expect(report).toHaveBeenCalledTimes(2);
});

it('writes an unchanged retry at the applied revision until saving succeeds', async () => {
  const initial = looksDocument();
  if (initial.name !== 'looks') throw Error('Expected Looks');
  let revision = 1;
  const edit = vi.fn<LlpApi['settings']['edit']>().mockImplementation(() =>
    Promise.resolve({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented disk failure',
        applied: {id: 'looks', revision: ++revision},
        unchangedFiles: ['looks.json'],
      },
    }),
  );
  const editor = new SettingsDocumentEditor<NamedDocument<'looks'>>(
    mockLlpApi({settings: {edit}}),
    {
      update: (base, value) => ({
        type: 'settings.update',
        name: 'looks',
        value,
        baseRevision: base.revision,
      }),
      report: vi.fn(),
      failureTitle: '저장 실패',
      logMessage: 'Could not save Looks',
    },
  );
  editor.adopt(initial);
  expect(
    await editor.change(value => ({...value, future: 'draft'}), 'saved'),
  ).toBe(false);
  const applied = editor.getSnapshot();
  editor.adopt(applied);
  expect(await editor.change(value => value, 'saved')).toBe(false);
  edit.mockResolvedValueOnce({ok: true, value: {id: 'looks', revision: 4}});
  expect(await editor.change(value => value, 'saved')).toBe(true);
  expect(
    edit.mock.calls.map(([command]) =>
      'baseRevision' in command ? command.baseRevision : undefined,
    ),
  ).toEqual([1, 2, 3]);
  expect(await editor.change(value => value, 'saved')).toBe(true);
  expect(edit).toHaveBeenCalledTimes(3);
});
