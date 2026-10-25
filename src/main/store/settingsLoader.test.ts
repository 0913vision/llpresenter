import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {isRecord} from '@shared/guards';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import {makeTempDir} from '../../../test/temp-dir';
import {recordingLogger} from '../displays/testing';
import {openAppConfig} from './appConfigFile';
import {loadStore} from './fileStore';
import {settingsCodecs} from './settingsCodecs';
import {openSettingsStore} from './settingsStore';

vi.mock('@shared/schema/settingsDocuments', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@shared/schema/settingsDocuments')>();
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
      typeof import('@shared/schema/settingsDocuments')
    >('@shared/schema/settingsDocuments');
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
});
