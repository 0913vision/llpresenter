import {expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {settingsDocument} from '@core/testing/settingsDocument';
import {createDefaultThemes} from '@core/themes/defaults';
import type {ThemesFile} from '@core/schema/themes';
import {ThemeEditor} from './themeEditor';

function document() {
  const result = settingsDocument('themes', createDefaultThemes());
  if (result.name !== 'themes') throw new Error('Expected themes document');
  return result;
}

it('requires persisted completion for rename while retaining the applied revision for retry', async () => {
  const initial = document();
  const edit = vi
    .fn<LlpApi['settings']['edit']>()
    .mockResolvedValueOnce({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented disk failure',
        applied: {id: 'themes', revision: 2},
        unchangedFiles: ['themes.json'],
      },
    })
    .mockResolvedValueOnce({ok: true, value: {id: 'themes', revision: 2}});
  const publish = vi.fn<(value: ThemesFile) => void>();
  const editor = new ThemeEditor(
    mockLlpApi({settings: {edit}}),
    publish,
    vi.fn(),
  );
  editor.adopt(initial);
  await expect(
    editor.change(
      file => ({
        ok: true,
        value: {...file, standby: {...file.standby, name: 'Renamed'}},
      }),
      'saved',
    ),
  ).resolves.toEqual({ok: true, value: false});
  expect(publish.mock.lastCall?.[0].standby.name).toBe('Renamed');
  await expect(
    editor.change(file => ({ok: true, value: file}), 'saved'),
  ).resolves.toEqual({ok: true, value: true});
  expect(edit.mock.calls[1]?.[0]).toMatchObject({baseRevision: 2});
});

it('holds displayed candidates across pushes until queued edits settle and then publishes the latest accepted value', async () => {
  const initial = document();
  let release: (
    value: Awaited<ReturnType<LlpApi['settings']['edit']>>,
  ) => void = () => undefined;
  const pending = new Promise<Awaited<ReturnType<LlpApi['settings']['edit']>>>(
    resolve => {
      release = resolve;
    },
  );
  const edit = vi
    .fn<LlpApi['settings']['edit']>()
    .mockReturnValueOnce(pending)
    .mockResolvedValueOnce({ok: true, value: {id: 'themes', revision: 3}});
  const published: ThemesFile[] = [];
  const editor = new ThemeEditor(
    mockLlpApi({settings: {edit}}),
    value => published.push(value),
    vi.fn(),
  );
  editor.adopt(initial);
  const first = editor.change(file => ({
    ok: true,
    value: {...file, standby: {...file.standby, name: 'First'}},
  }));
  const second = editor.change(file => ({
    ok: true,
    value: {
      ...file,
      standby: {...file.standby, name: `${file.standby.name} second`},
    },
  }));
  await vi.waitFor(() => expect(edit).toHaveBeenCalledOnce());
  expect(published.at(-1)?.standby.name).toBe('First');
  editor.adopt(initial);
  expect(published.at(-1)?.standby.name).toBe('First');
  release({ok: true, value: {id: 'themes', revision: 2}});
  await Promise.all([first, second]);
  expect(published.at(-1)?.standby.name).toBe('First second');
  expect(edit.mock.calls[1]?.[0]).toMatchObject({baseRevision: 2});
});

it('restores the accepted view after a refusal and reports domain failures without publishing them', async () => {
  const initial = document();
  const edit = vi.fn<LlpApi['settings']['edit']>().mockResolvedValue({
    ok: false,
    error: {reason: 'stale', message: 'Changed elsewhere'},
  });
  const publish = vi.fn();
  const editor = new ThemeEditor(
    mockLlpApi({settings: {edit}}),
    publish,
    vi.fn(),
  );
  editor.adopt(initial);
  await expect(
    editor.change(file => ({
      ok: true,
      value: {...file, standby: {...file.standby, name: 'Candidate'}},
    })),
  ).resolves.toEqual({ok: true, value: false});
  expect(publish).toHaveBeenLastCalledWith(initial.value);
  const count = edit.mock.calls.length;
  await expect(
    editor.change(() => ({ok: false, error: 'name'})),
  ).resolves.toEqual({ok: false, error: 'name'});
  expect(edit).toHaveBeenCalledTimes(count);
});
