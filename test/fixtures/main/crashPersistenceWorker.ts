import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {createMediaId} from '@core/schema/ids';
import {emptyLiveState} from '@core/live/state';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {LiveStore} from '../../../src/main/live/store';
import {RecoveryRecordWriter} from '../../../src/main/live/recovery/recordWriter';
import {MediaImporter} from '../../../src/main/media/mediaImporter';
import {MediaStore} from '../../../src/main/store/mediaStore';
import {EMPTY_MEDIA_LIST} from '../../../src/main/store/defaults';
import {writeFileAtomically} from '../../../src/main/store/atomicWrite';
import {openRecoverySession} from '../../../src/main/live/recovery/session';
import {recordingLogger} from './displays/testing';

const SCREEN = '00000000-0000-4000-8000-000000000001';
const ID = createMediaId('00000000-0000-4000-8000-000000000999');

function ready(): void {
  process.send?.({ready: true});
}

async function waitForKill(): Promise<never> {
  setInterval(() => undefined, 1000);
  return new Promise(() => undefined);
}

async function run(): Promise<void> {
  const [mode, folder] = process.argv.slice(2);
  if (!folder) throw new Error('Missing test folder');
  const log = recordingLogger();
  if (mode === 'on' || mode === 'off') {
    await openRecoverySession({folder, log});
    const store = new LiveStore({
      ...emptyLiveState(),
      outputs: {[SCREEN]: mode === 'off'},
      stageMessage: 'Previously visible note',
    });
    const record = new RecoveryRecordWriter({
      file: join(folder, 'live.json'),
      store,
      serviceId: () => null,
      log,
    });
    store.connectOutputPersistence(state => record.persistOutputs(state));
    record.start();
    await record.settled();
    store.subscribe(state => {
      if (state.outputs[SCREEN] === (mode === 'on')) ready();
    });
    store.dispatch({type: 'output.set', screenId: SCREEN, on: mode === 'on'});
    await waitForKill();
    return;
  }
  const mediaFolder = join(folder, 'Media');
  const file = join(folder, 'media.json');
  const document = parseMediaDocument({
    name: 'media',
    value: EMPTY_MEDIA_LIST,
    revision: 1,
    access: 'editable',
  });
  if (!document.ok) throw new Error(document.error.message);
  await writeFile(file, JSON.stringify(EMPTY_MEDIA_LIST));
  const store = new MediaStore({
    document: document.value,
    file,
    mediaFolder,
    log,
    delayMs: 0,
    files: {
      write: ({target, text}) => writeFileAtomically(target.file, text),
      remove: async () => ({ok: true, value: undefined}),
    },
  });
  const source = join(folder, 'source.png');
  await writeFile(source, 'fixture image bytes');
  const importer = new MediaImporter({
    store: async () => ({
      folder: store.folder,
      get: () => store.get(),
      add: async (commit, playlist) => {
        const added = await store.add(commit, playlist);
        if (!added.ok) throw new Error('Fixture registry commit failed');
        ready();
        return waitForKill();
      },
    }),
    log,
    createId: () => ID,
    chooseFiles: async () => [],
    report: () => undefined,
    analyse: async () => {
      if (mode === 'copied') {
        ready();
        return waitForKill();
      }
      return {kind: 'read', facts: {}};
    },
    saveThumbnail: async () => undefined,
  });
  await importer.import(
    {source: {kind: 'files', paths: [source]}, playlist: null},
    new AbortController().signal,
  );
}

run().catch((error: unknown) => {
  process.send?.({error: String(error)});
  process.exitCode = 1;
});
