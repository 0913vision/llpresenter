import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {createScreenId} from '@core/schema/ids';
import type {SettingsReader} from '@core/schema/settingsReader';
import {RECOVERY_RECORD_LIMITS} from '@core/schema/recoveryRecord';
import {overlaySettings} from '@fixtures/core/overlays';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {
  recoveryContent,
  recoveryText,
  SAVED_AT,
} from '@fixtures/main/live/recovery';
import {
  RecoveryController,
  recoverySources,
} from '@main/live/recovery/controller';
import {planRecovery, type RecoveryStep} from '@main/live/recovery/plan';
import {dispatchBatched, type LiveStore} from '@main/live/store';

const files = vi.hoisted(() => {
  const state: {text: string | null} = {text: null};
  return state;
});

vi.mock('node:fs/promises', () => ({
  stat: async () => {
    if (files.text === null) {
      throw Object.assign(new Error('missing'), {code: 'ENOENT'});
    }
    return {size: files.text.length};
  },
  readFile: async () => files.text ?? '',
}));
vi.mock('@main/live/recovery/plan', () => ({planRecovery: vi.fn()}));
vi.mock('@main/live/store', async importOriginal => ({
  ...(await importOriginal<typeof import('@main/live/store')>()),
  dispatchBatched: vi.fn(() => true),
}));

const MAIN = createScreenId('00000000-0000-4000-8000-000000000001');
const STEPS: readonly RecoveryStep[] = [
  {
    row: {kind: 'outputs', screens: [{screenId: MAIN, name: 'Main'}]},
    commands: [{type: 'output.set', screenId: MAIN, on: true}],
  },
  {
    row: {
      kind: 'showing',
      counts: {messages: 0, props: 0, stageMessages: 1, notices: 0},
    },
    commands: [{type: 'stage.message.set', text: 'Fixture stage note'}],
  },
];
const UNAVAILABLE = {ok: false, error: {reason: 'unavailable'}};

function setup({
  crashed = true,
  text = recoveryText(emptyLiveState()),
  steps = STEPS,
  sources = true,
}: {
  readonly crashed?: boolean;
  readonly text?: string | null;
  readonly steps?: readonly RecoveryStep[];
  readonly sources?: boolean;
} = {}) {
  vi.clearAllMocks();
  files.text = text;
  vi.mocked(planRecovery).mockReturnValue(steps);
  const calls: string[] = [];
  const record = {start: vi.fn(() => calls.push('record'))};
  const showOutputsOnLaunch = vi.fn(async () => {
    calls.push('outputs on launch');
  });
  const runStartupMacros = vi.fn(async () => {
    calls.push('startup macros');
  });
  const log = recordingLogger();
  const store: Pick<LiveStore, 'handles' | 'dispatch'> = {
    handles: vi.fn(() => true),
    dispatch: vi.fn(() => true),
  };
  const controller = new RecoveryController({
    crashed,
    file: 'C:/data/live.json',
    store,
    sources: Promise.resolve(
      sources
        ? {settings: overlaySettings().reader, content: recoveryContent()}
        : null,
    ),
    record,
    showOutputsOnLaunch,
    runStartupMacros,
    log,
  });
  return {controller, store, calls, record, runStartupMacros, log};
}

describe('RecoveryController', () => {
  it('records a normal launch at once and turns the outputs on without asking', async () => {
    const {controller, calls} = setup({crashed: false});

    await controller.start();

    expect(calls).toEqual(['record', 'outputs on launch']);
    expect(await controller.summary()).toBeNull();
    expect(await controller.startFresh()).toMatchObject(UNAVAILABLE);
  });

  it('offers the planned rows after a crash and changes nothing before the answer', async () => {
    const {controller, calls} = setup();

    expect(await controller.summary()).toEqual({
      savedAt: SAVED_AT,
      rows: STEPS.map(({row}) => row),
    });
    expect(calls).toEqual([]);
    expect(dispatchBatched).not.toHaveBeenCalled();
  });

  it('restores the checked rows in plan order, then records the session', async () => {
    const {controller, store, calls, log} = setup();

    expect(
      await controller.apply({savedAt: SAVED_AT, rows: ['showing', 'outputs']}),
    ).toEqual({ok: true, value: null});

    expect(dispatchBatched).toHaveBeenCalledExactlyOnceWith(
      store,
      STEPS.flatMap(({commands}) => commands),
      log,
    );
    expect(calls).toEqual(['record']);
    expect(await controller.summary()).toBeNull();
    expect(await controller.startFresh()).toMatchObject(UNAVAILABLE);
  });

  it('reports a restore that changed nothing and still ends the wait', async () => {
    const {controller, record, log} = setup();
    vi.mocked(dispatchBatched).mockReturnValueOnce(false);

    expect(
      await controller.apply({savedAt: SAVED_AT, rows: ['outputs']}),
    ).toMatchObject({ok: false, error: {reason: 'apply-failed'}});
    expect(log.messages('warn')).toContain(
      'nothing of the output state was restored',
    );
    expect(record.start).toHaveBeenCalledOnce();
  });

  it('refuses a stale answer and a row it did not offer, and keeps waiting', async () => {
    const {controller, record} = setup({steps: STEPS.slice(1)});

    expect(
      await controller.apply({
        savedAt: '2026-10-26T06:00:01+09:00',
        rows: ['showing'],
      }),
    ).toMatchObject({ok: false, error: {reason: 'stale'}});
    expect(
      await controller.apply({savedAt: SAVED_AT, rows: ['showing', 'outputs']}),
    ).toMatchObject({ok: false, error: {reason: 'invalid-selection'}});
    expect(record.start).not.toHaveBeenCalled();
    expect(await controller.summary()).not.toBeNull();
  });

  it('starts fresh with the outputs and the startup 매크로 held back by the crash', async () => {
    const {controller, calls} = setup();

    expect(await controller.startFresh()).toEqual({ok: true, value: null});
    expect(calls).toEqual(['record', 'outputs on launch', 'startup macros']);
    expect(dispatchBatched).not.toHaveBeenCalled();
  });

  it('reports startup 매크로 that fail and still records the session', async () => {
    const {controller, record, runStartupMacros, log} = setup();
    runStartupMacros.mockRejectedValueOnce(new Error('no macros'));

    expect(await controller.startFresh()).toMatchObject({
      ok: false,
      error: {reason: 'apply-failed'},
    });
    expect(record.start).toHaveBeenCalledOnce();
    expect(log.messages('error')).toEqual(['could not run the startup macros']);
  });

  it('answers once when two answers race', async () => {
    const {controller, calls} = setup();

    const [restored, fresh] = await Promise.all([
      controller.apply({savedAt: SAVED_AT, rows: ['outputs']}),
      controller.startFresh(),
    ]);

    expect(restored).toEqual({ok: true, value: null});
    expect(fresh).toMatchObject(UNAVAILABLE);
    expect(calls).toEqual(['record']);
  });

  it.each([
    ['no record', {text: null}, 'no recovery record after the crash'],
    ['a broken record', {text: '{'}, 'ignored an invalid recovery record'],
    [
      'a record over its byte limit',
      {text: ' '.repeat(RECOVERY_RECORD_LIMITS.bytes + 1)},
      'ignored a recovery record over its byte limit',
    ],
    [
      'a record with nothing to restore',
      {steps: []},
      'nothing to restore after the crash',
    ],
    [
      'no settings or content',
      {sources: false},
      'recovery has no settings or content to check',
    ],
  ] as const)(
    'launches normally by itself after a crash with %s',
    async (_case, options, logged) => {
      const {controller, calls, log} = setup(options);

      await controller.start();

      expect(calls).toEqual(['record', 'outputs on launch', 'startup macros']);
      expect(log.entries.map(({message}) => message)).toContain(logged);
      expect(await controller.startFresh()).toMatchObject(UNAVAILABLE);
    },
  );
});

describe('recoverySources', () => {
  it('waits for both the settings and the content', async () => {
    const log = recordingLogger();
    const settings = overlaySettings().reader;
    const content = recoveryContent();
    const ready = (value: SettingsReader | null) =>
      recoverySources(
        {settings: Promise.resolve(value), content: Promise.resolve(content)},
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
