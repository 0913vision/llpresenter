import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {isRecord} from '@core/common/guards';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {makeTempDir} from '../../../test/temp-dir';
import {recordingLogger} from '../displays/testing';
import {openAppConfig} from './appConfigFile';
import {loadStore} from './fileStore';
import {settingsCodecs} from './settingsCodecs';
import {Saver} from './saver';
import {openSettingsStore} from './settingsStore';
import {writeJson} from './testFiles';

vi.mock('@core/schema/settingsDocuments', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@core/schema/settingsDocuments')>();
  return {
    ...actual,
    parseSettingsDocument: vi.fn(actual.parseSettingsDocument),
  };
});

async function setup() {
  const folder = await makeTempDir();
  const log = recordingLogger();
  const appConfig = await openAppConfig({file: join(folder, 'app.json'), log});
  const loaded = await loadStore({
    documents: folder,
    developmentFolder: folder,
    appConfig,
  });
  if (!loaded.ok) throw new Error(loaded.error.message);
  return {loaded: loaded.value, log};
}

describe('independent settings area loading', () => {
  it('does not make an incompatible newer original editable through an older recovery copy', async () => {
    const {loaded, log} = await setup();
    const file = join(loaded.locations.settings, 'labels.json');
    const original = JSON.stringify({
      format: 'llsettings.labels',
      schemaVersion: 2,
      labels: 'future-shape',
    });
    await writeJson(file, original);
    await writeJson(
      join(
        loaded.locations.recovery,
        'settings',
        'labels',
        '2026-10-25T09-00-00.000Z.json',
      ),
      {format: 'llsettings.labels', schemaVersion: 1, labels: []},
    );
    const store = await openSettingsStore(loaded, log);
    onTestFinished(() => store.dispose());
    const current = store.get('labels');
    expect(current.access).toBe('readOnly');
    expect(
      await store.apply({
        type: 'settings.update',
        name: 'labels',
        value: {format: 'llsettings.labels', schemaVersion: 1, labels: []},
        baseRevision: 1,
      }),
    ).toMatchObject({ok: false, error: {reason: 'read-only'}});
    expect(await readFile(file, 'utf8')).toBe(original);
  });
  it('uses area defaults after document validation throws and continues to later files', async () => {
    const {loaded, log} = await setup();
    const file = join(loaded.locations.settings, 'labels.json');
    await mkdir(loaded.locations.settings, {recursive: true});
    const original = JSON.stringify({
      format: 'llsettings.labels',
      schemaVersion: 1,
      labels: [],
      trip: true,
    });
    await writeFile(file, original);
    const actual = await vi.importActual<
      typeof import('@core/schema/settingsDocuments')
    >('@core/schema/settingsDocuments');
    vi.mocked(parseSettingsDocument).mockImplementation(value => {
      if (
        isRecord(value) &&
        value.name === 'labels' &&
        isRecord(value.value) &&
        value.value.trip === true
      ) {
        throw new Error('One area failed');
      }
      return actual.parseSettingsDocument(value);
    });
    onTestFinished(() => {
      vi.mocked(parseSettingsDocument).mockImplementation(
        actual.parseSettingsDocument,
      );
    });
    const store = await openSettingsStore(loaded, log);
    onTestFinished(() => store.dispose());
    expect(store.get('labels')).toMatchObject({name: 'labels', revision: 1});
    expect(store.get('labels').value).not.toHaveProperty('trip');
    expect(store.get('shortcuts').name).toBe('shortcuts');
    const problems: string[] = [];
    store.subscribeProblems(problem => problems.push(problem.file));
    expect(problems).toEqual(['labels.json']);
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('uses defaults after serialization throws, reports the area, and creates the next file', async () => {
    const {loaded, log} = await setup();
    const spy = vi
      .spyOn(settingsCodecs.messages, 'serialize')
      .mockImplementationOnce(() => {
        throw new Error('Serialization failed');
      });
    onTestFinished(() => spy.mockRestore());
    const store = await openSettingsStore(loaded, log);
    onTestFinished(() => store.dispose());
    expect(store.get('messages')).toMatchObject({
      value: {templates: []},
    });
    expect(store.get('messages').value).toHaveProperty('stagePresets');
    expect(store.get('notices').name).toBe('notices');
    const problems: string[] = [];
    store.subscribeProblems(problem => problems.push(problem.file));
    expect(problems).toEqual(['messages.json']);
    expect(
      JSON.parse(
        await readFile(join(loaded.locations.settings, 'notices.json'), 'utf8'),
      ),
    ).toMatchObject({format: settingsCodecs.notices.format});
  });

  it('uses defaults and reports the area when its serialization returns an error', async () => {
    const {loaded, log} = await setup();
    const spy = vi
      .spyOn(settingsCodecs.messages, 'serialize')
      .mockReturnValueOnce({
        ok: false,
        error: {
          kind: 'invalid',
          file: 'messages.json',
          field: '',
          message: 'No',
        },
      });
    onTestFinished(() => spy.mockRestore());
    const store = await openSettingsStore(loaded, log);
    onTestFinished(() => store.dispose());
    expect(store.get('messages').name).toBe('messages');
    expect(store.get('notices').name).toBe('notices');
    const problems: string[] = [];
    store.subscribeProblems(problem =>
      problems.push(`${problem.file}: ${problem.error.message}`),
    );
    expect(problems).toEqual(['messages.json: No']);
  });

  it('uses defaults and reports the area when creating its file fails', async () => {
    const {loaded, log} = await setup();
    const original = Saver.prototype.save;
    const spy = vi.spyOn(Saver.prototype, 'save').mockImplementation(function (
      this: Saver,
      request,
    ) {
      return request.target.id === 'messages'
        ? Promise.resolve({
            ok: false,
            error: {file: request.target.file, message: 'Disk is full'},
          })
        : original.call(this, request);
    });
    onTestFinished(() => spy.mockRestore());
    const store = await openSettingsStore(loaded, log);
    onTestFinished(() => store.dispose());
    expect(store.get('messages').name).toBe('messages');
    expect(store.get('notices').name).toBe('notices');
    const problems: string[] = [];
    store.subscribeProblems(problem => problems.push(problem.file));
    expect(problems).toEqual(['messages.json']);
  });

  it('keeps the other areas when an area cannot build its defaults', async () => {
    const {loaded, log} = await setup();
    const actual = await vi.importActual<
      typeof import('@core/schema/settingsDocuments')
    >('@core/schema/settingsDocuments');
    vi.mocked(parseSettingsDocument).mockImplementation(value =>
      isRecord(value) && value.name === 'messages' && value.revision === 1
        ? {
            ok: false,
            error: {
              kind: 'invalid',
              file: '',
              field: '',
              message: 'Bad defaults',
            },
          }
        : actual.parseSettingsDocument(value),
    );
    onTestFinished(() => {
      vi.mocked(parseSettingsDocument).mockImplementation(
        actual.parseSettingsDocument,
      );
    });
    const store = await openSettingsStore(loaded, log);
    onTestFinished(() => store.dispose());
    expect(store.get('notices').name).toBe('notices');
    const problems: string[] = [];
    store.subscribeProblems(problem => problems.push(problem.file));
    expect(problems).toEqual(['messages.json']);
  });
});
