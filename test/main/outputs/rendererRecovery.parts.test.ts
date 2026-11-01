import {describe, expect, it, vi} from 'vitest';
import {installMockClock} from '@fixtures/mockClock';
import {recordingLogger} from '@fixtures/main/displays/testing';
import type {LoadFailure} from '@main/outputs/pageLoad';
import {
  RELAUNCH_DELAY_MS,
  RendererRecovery,
} from '@main/outputs/rendererRecovery';

const mocks = vi.hoisted(() => {
  class Load {
    readonly startDrawLimit = vi.fn();
    readonly stopDrawLimit = vi.fn();
    readonly settle = vi.fn();
    constructor(
      readonly loading: Promise<void>,
      readonly fail: (failure: LoadFailure) => void,
    ) {
      loads.push(this);
    }
  }
  const loads: Load[] = [];
  const allowed = {crash: true};
  const budget = {
    allowed,
    recordCrash: vi.fn(() => allowed.crash),
    reset: vi.fn(),
  };
  return {Load, loads, budget};
});

vi.mock('@main/outputs/pageLoad', async importOriginal => ({
  ...(await importOriginal<typeof import('@main/outputs/pageLoad')>()),
  PageLoad: mocks.Load,
}));
vi.mock('@main/outputs/restartBudget', async importOriginal => ({
  ...(await importOriginal<typeof import('@main/outputs/restartBudget')>()),
  RestartBudget: class {
    readonly recordCrash = mocks.budget.recordCrash;
    readonly reset = mocks.budget.reset;
  },
}));

const CRASH = {reason: 'crashed', exitCode: -1};

function setUp() {
  mocks.loads.length = 0;
  mocks.budget.allowed.crash = true;
  vi.clearAllMocks();
  const clock = installMockClock();
  const log = recordingLogger();
  const recovery = new RendererRecovery({
    screenId: 'main',
    reload: () => Promise.resolve(),
    log,
  });
  const reloaded = async () => {
    recovery.crashed(CRASH);
    await clock.advance(RELAUNCH_DELAY_MS);
    const load = mocks.loads.at(-1);
    if (load === undefined) throw new Error('No reload started');
    return load;
  };
  return {log, recovery, reloaded};
}

describe('RendererRecovery with its page load and restart budget', () => {
  it('starts the draw limit of a reload, and starts it again when the output turns on', async () => {
    const {recovery, reloaded} = setUp();
    const load = await reloaded();
    expect(load.startDrawLimit).toHaveBeenCalledOnce();

    recovery.resume();

    expect(load.startDrawLimit).toHaveBeenCalledTimes(2);
  });

  it('holds the limit at the crash the restart budget refuses', () => {
    const {log, recovery} = setUp();
    mocks.budget.allowed.crash = false;

    recovery.crashed(CRASH);

    expect(mocks.budget.recordCrash).toHaveBeenCalledOnce();
    expect(recovery.state).toBe('limited');
    expect(log.messages('error')).toContain(
      'output window failed too often; showing the empty picture until a restart attempt works',
    );
  });

  it('counts a quick reload that does not draw as a crash', async () => {
    const {log, recovery, reloaded} = setUp();
    const load = await reloaded();

    load.fail({kind: 'not-drawn'});

    expect(mocks.budget.recordCrash).toHaveBeenCalledTimes(2);
    expect(recovery.state).toBe('restarting');
    expect(log.messages('error')).toContain(
      'output window page did not draw in time',
    );
  });
});
