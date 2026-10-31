import type {SettingsReader} from '@core/schema/settingsReader';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {createMediaId, createMessageId, type ServiceId} from '@core/schema/ids';
import {RECOVERY_RECORD_LIMITS} from '@core/schema/recoveryRecord';
import {makeTempDir} from '../../../../test/temp-dir';
import {recordingLogger} from '../../displays/testing';
import {SliceRegistry} from '../sliceRegistry';
import {LiveStore} from '../store';
import {
  CAPTIONS,
  IMAGES,
  MAIN,
  NOTICE,
  overlaySettings,
  overlayUuid,
  PROP,
  settingsDocument,
  TEXT_STYLE,
} from '../testing/overlays';
import {
  OTHER_SERVICE,
  recoveryContent,
  recoveryText,
  SAVED_AT,
  SAVED_AT_MS,
  SERVICE,
  SONG_ITEM,
} from '../testing/recovery';
import {RecoveryController, recoverySources} from './controller';
import {RecoveryRecordWriter} from './recordWriter';

const NOW = SAVED_AT_MS + 60_000;
const FIRST_IMAGE = createMediaId(overlayUuid(30));
const FIRST_LOOK = overlayUuid(61);
const SECOND_LOOK = overlayUuid(62);

const CRASH_STATE: LiveState = {
  ...emptyLiveState(),
  outputs: {[MAIN]: true},
  stageMessage: 'Fixture stage note',
  layers: {
    ...emptyLiveState().layers,
    slide: {itemId: SONG_ITEM, position: 0, label: null, lines: ['old']},
  },
};

interface SetupOptions {
  readonly crashed?: boolean;
  readonly text?: string | null;
  readonly sources?: 'ready' | 'missing';
  readonly registry?: SliceRegistry;
}

async function setup({
  crashed = true,
  text = recoveryText(CRASH_STATE),
  sources = 'ready',
  registry,
}: SetupOptions = {}) {
  const file = join(await makeTempDir(), 'live.json');
  if (text !== null) await writeFile(file, text);
  const settings = overlaySettings();
  const store = new LiveStore(undefined, () => NOW, registry);
  store.connectSettings(settings.reader);
  const broadcasts: LiveState[] = [];
  store.subscribe(state => broadcasts.push(state));
  const log = recordingLogger();
  const calls: string[] = [];
  const record = {
    start: vi.fn(() => {
      calls.push(`record from version ${store.state.version}`);
    }),
  };
  const showOutputsOnLaunch = vi.fn(async () => {
    calls.push('outputs on launch');
  });
  const runStartupMacros = vi.fn(async () => {
    calls.push('startup macros');
  });
  const controller = new RecoveryController({
    crashed,
    file,
    store,
    sources: Promise.resolve(
      sources === 'ready'
        ? {settings: settings.reader, content: recoveryContent()}
        : null,
    ),
    record,
    showOutputsOnLaunch,
    runStartupMacros,
    log,
  });
  return {
    controller,
    store,
    settings,
    broadcasts,
    log,
    calls,
    record,
    runStartupMacros,
  };
}

const UNAVAILABLE = {ok: false, error: {reason: 'unavailable'}};

const FILE_WRITE_WAIT_MS = 5000;

describe('recovery controller', () => {
  it('records a normal launch at once and applies 켤 때 화면 출력 without asking', async () => {
    const {controller, calls} = await setup({crashed: false});
    await controller.start();
    expect(calls).toEqual(['record from version 0', 'outputs on launch']);
    expect(await controller.summary()).toBeNull();
    expect(await controller.startFresh()).toMatchObject(UNAVAILABLE);
    expect(
      await controller.apply({savedAt: SAVED_AT, rows: ['outputs']}),
    ).toMatchObject(UNAVAILABLE);
    expect(calls).toHaveLength(2);
  });

  it('keeps every output off after a crash and offers the rows of its record', async () => {
    const {controller, store, calls} = await setup();
    await controller.start();
    expect(store.state.outputs).toEqual({});
    expect(calls).toEqual([]);
    expect(await controller.summary()).toEqual({
      savedAt: SAVED_AT,
      rows: [
        {kind: 'outputs', screens: [{screenId: MAIN, name: 'Main'}]},
        expect.objectContaining({kind: 'slide'}),
        {
          kind: 'showing',
          counts: {
            messages: 0,
            props: 0,
            stageMessages: 1,
            notices: 0,
            stageLayouts: 0,
          },
        },
      ],
    });
  });

  it('restores the checked rows in order in one broadcast, without startup macros', async () => {
    const {controller, store, broadcasts, calls} = await setup();
    const dispatch = vi.spyOn(store, 'dispatch');
    const result = await controller.apply({
      savedAt: SAVED_AT,
      rows: ['showing', 'outputs'],
    });
    expect(result).toEqual({ok: true, value: null});
    expect(dispatch.mock.calls[0]?.[0]).toEqual({
      type: 'live.batch',
      commands: [
        {type: 'output.set', screenId: MAIN, on: true},
        {type: 'stage.message.set', text: 'Fixture stage note'},
      ],
    });
    expect(broadcasts).toHaveLength(1);
    expect(store.state).toMatchObject({
      outputs: {[MAIN]: true, main: true},
      stageMessage: 'Fixture stage note',
      layers: {slide: null},
    });
    expect(calls).toEqual(['record from version 1']);
    expect(await controller.summary()).toBeNull();
    expect(
      await controller.apply({savedAt: SAVED_AT, rows: ['outputs']}),
    ).toMatchObject(UNAVAILABLE);
    expect(await controller.startFresh()).toMatchObject(UNAVAILABLE);
  });

  it('puts back the recorded Look while it still exists', async () => {
    const {controller, store, settings} = await setup({
      text: recoveryText({...CRASH_STATE, lookId: SECOND_LOOK}),
    });
    settings.update(
      settingsDocument('looks', {
        current: FIRST_LOOK,
        looks: [
          {id: FIRST_LOOK, name: 'First', screens: {}},
          {id: SECOND_LOOK, name: 'Second', screens: {}},
        ],
        lyricStyles: [],
      }),
    );
    await controller.apply({savedAt: SAVED_AT, rows: ['outputs']});
    expect(store.state).toMatchObject({
      lookId: SECOND_LOOK,
      outputs: {[MAIN]: true},
    });
  });

  it('resumes messages with the time they had left and a paused 공지 at its image', async () => {
    const {controller, store} = await setup({
      text: recoveryText({
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          prop: {
            propId: PROP,
            items: [
              {
                propId: PROP,
                content: {kind: 'image', media: FIRST_IMAGE},
                targets: [MAIN],
              },
            ],
          },
          message: {
            messageId: overlayUuid(60),
            text: 'Fixture message',
            items: [
              {
                messageId: createMessageId(overlayUuid(60)),
                text: 'Fixture message',
                targets: [CAPTIONS],
                excludedTargets: [],
                startedAt: SAVED_AT_MS - 1000,
                expiresAt: SAVED_AT_MS + 2500,
              },
            ],
          },
          notice: {
            noticeId: NOTICE,
            playback: {
              media: IMAGES,
              position: 0,
              interval: 5,
              loop: false,
              targets: [MAIN],
              startedAt: SAVED_AT_MS - 6000,
              pausedAt: SAVED_AT_MS - 1000,
            },
          },
        },
      }),
    });
    await controller.apply({savedAt: SAVED_AT, rows: ['showing']});
    const {prop, message, notice} = store.state.layers;
    expect(prop?.items?.map(({propId, content}) => [propId, content])).toEqual([
      [PROP, {kind: 'text', text: 'Fixture prop', style: TEXT_STYLE}],
    ]);
    expect(message?.items).toMatchObject([
      {
        text: 'Fixture message',
        targets: [CAPTIONS],
        startedAt: NOW,
        expiresAt: NOW + 2500,
      },
    ]);
    expect(notice?.playback).toMatchObject({
      position: 1,
      startedAt: NOW,
      pausedAt: NOW,
    });
  });

  it('reports a restore that changed nothing and still ends the wait', async () => {
    const {controller, record, log} = await setup({
      registry: new SliceRegistry([]),
    });
    expect(
      await controller.apply({savedAt: SAVED_AT, rows: ['outputs']}),
    ).toMatchObject({ok: false, error: {reason: 'apply-failed'}});
    expect(log.messages('warn')).toContain(
      'nothing of the output state was restored',
    );
    expect(record.start).toHaveBeenCalledOnce();
    expect(await controller.summary()).toBeNull();
  });

  it('refuses a stale or unoffered answer and keeps waiting', async () => {
    const {controller, record} = await setup();
    expect(
      await controller.apply({
        savedAt: '2026-10-26T06:00:01+09:00',
        rows: ['outputs'],
      }),
    ).toMatchObject({ok: false, error: {reason: 'stale'}});
    expect(record.start).not.toHaveBeenCalled();
    expect(await controller.summary()).not.toBeNull();
  });

  it('refuses a row the summary did not offer', async () => {
    const {controller, record} = await setup({
      text: recoveryText(emptyWith({stage: true})),
    });
    expect(
      await controller.apply({savedAt: SAVED_AT, rows: ['showing', 'slide']}),
    ).toMatchObject({ok: false, error: {reason: 'invalid-selection'}});
    expect(record.start).not.toHaveBeenCalled();
    expect(await controller.summary()).not.toBeNull();
  });

  it('starts fresh with 켤 때 화면 출력 and the startup macros held back by the crash', async () => {
    const {controller, store, calls} = await setup();
    expect(await controller.startFresh()).toEqual({ok: true, value: null});
    expect(calls).toEqual([
      'record from version 0',
      'outputs on launch',
      'startup macros',
    ]);
    expect(store.state.outputs).toEqual({});
    expect(await controller.summary()).toBeNull();
    expect(
      await controller.apply({savedAt: SAVED_AT, rows: ['outputs']}),
    ).toMatchObject(UNAVAILABLE);
  });

  it('reports startup macros that fail and still records the session', async () => {
    const {controller, record, runStartupMacros, log} = await setup();
    runStartupMacros.mockRejectedValueOnce(new Error('no macros'));
    expect(await controller.startFresh()).toMatchObject({
      ok: false,
      error: {reason: 'apply-failed'},
    });
    expect(record.start).toHaveBeenCalledOnce();
    expect(log.messages('error')).toEqual(['could not run the startup macros']);
  });

  it('answers once when two answers race', async () => {
    const {controller, calls} = await setup();
    const [restored, fresh] = await Promise.all([
      controller.apply({savedAt: SAVED_AT, rows: ['outputs']}),
      controller.startFresh(),
    ]);
    expect(restored).toEqual({ok: true, value: null});
    expect(fresh).toMatchObject(UNAVAILABLE);
    expect(calls).toEqual(['record from version 1']);
  });

  it.each<[string, SetupOptions, string]>([
    ['no record', {text: null}, 'no recovery record after the crash'],
    ['a broken record', {text: '{'}, 'ignored an invalid recovery record'],
    [
      'a record over its byte limit',
      {text: ' '.repeat(RECOVERY_RECORD_LIMITS.bytes + 1)},
      'ignored a recovery record over its byte limit',
    ],
    [
      'a record with nothing to restore',
      {text: recoveryText(emptyLiveState())},
      'nothing to restore after the crash',
    ],
    [
      'no settings or content',
      {sources: 'missing'},
      'recovery has no settings or content to check',
    ],
  ])(
    'launches normally by itself after a crash with %s',
    async (_case, options, logged) => {
      const {controller, calls, log} = await setup(options);
      await controller.start();
      expect(calls).toEqual([
        'record from version 0',
        'outputs on launch',
        'startup macros',
      ]);
      expect(log.entries.map(({message}) => message)).toContain(logged);
      expect(await controller.summary()).toBeNull();
      expect(await controller.startFresh()).toMatchObject(UNAVAILABLE);
      expect(calls).toHaveLength(3);
    },
  );
});

describe('a record written after another service opened', () => {
  it('still offers the live 슬라이드 from the service it came from', async () => {
    const file = join(await makeTempDir(), 'live.json');
    const settings = overlaySettings();
    const store = new LiveStore(undefined, () => NOW);
    store.connectSettings(settings.reader);
    let open: ServiceId | null = SERVICE;
    const writer = new RecoveryRecordWriter({
      file,
      store,
      serviceId: () => open,
      log: recordingLogger(),
      intervalMs: 1,
    });
    writer.start();
    store.dispatch({
      type: 'slide.show',
      slide: {
        itemId: SONG_ITEM,
        position: 1,
        label: '후렴',
        lines: ['Fixture'],
      },
    });
    open = OTHER_SERVICE;
    store.dispatch({type: 'stage.message.set', text: 'Fixture stage note'});
    // NOTE(0913vision): A real file write can take longer than waitFor's
    // default second while the whole suite runs in parallel.
    await vi.waitFor(
      async () => expect(await readFile(file, 'utf8')).toContain(OTHER_SERVICE),
      {timeout: FILE_WRITE_WAIT_MS},
    );
    writer.stop();
    await writer.settled();
    const controller = new RecoveryController({
      crashed: true,
      file,
      store: new LiveStore(undefined, () => NOW),
      sources: Promise.resolve({
        settings: settings.reader,
        content: recoveryContent(),
      }),
      record: {start: vi.fn()},
      showOutputsOnLaunch: vi.fn(async () => undefined),
      runStartupMacros: vi.fn(async () => undefined),
      log: recordingLogger(),
    });
    expect((await controller.summary())?.rows).toContainEqual({
      kind: 'slide',
      slide: {
        serviceId: SERVICE,
        itemId: SONG_ITEM,
        title: '만복의 근원 하나님',
        position: 1,
        slideCount: 5,
      },
    });
  });
});

describe('recovery sources', () => {
  it('waits for both the settings and the content', async () => {
    const log = recordingLogger();
    const settings = overlaySettings().reader;
    const content = recoveryContent();
    const ready = (value: SettingsReader | null) =>
      recoverySources(
        {
          settings: Promise.resolve(value),
          content: Promise.resolve(content),
        },
        log,
      );
    expect(await ready(settings)).toEqual({settings, content});
    expect(await ready(null)).toBeNull();
    expect(
      await recoverySources(
        {
          settings: Promise.reject(new Error('broken')),
          content: Promise.resolve(null),
        },
        log,
      ),
    ).toBeNull();
    expect(log.messages('error')).toEqual([
      'could not read the recovery sources',
    ]);
  });
});

function emptyWith({stage}: {readonly stage: boolean}): LiveState {
  return {
    ...emptyLiveState(),
    ...(stage ? {stageMessage: 'Fixture stage note'} : {}),
  };
}
