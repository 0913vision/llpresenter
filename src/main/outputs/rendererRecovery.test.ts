import {describe, expect, it, vi} from 'vitest';
import {installFakeClock, type FakeClock} from '../../../test/fake-clock';
import {recordingLogger} from '../displays/testing';
import {
  COOLDOWN_STEPS_MS,
  DRAW_LIMIT_MS,
  RELAUNCH_DELAY_MS,
  RendererRecovery,
  SURVIVAL_MS,
} from './rendererRecovery';
import {CRASH_LIMIT} from './restartBudget';

const CRASH = {reason: 'crashed', exitCode: -1073741819};
const SECOND = 1000;

const LOAD_ERROR = new Error('ERR_CONNECTION_REFUSED');

function setUp() {
  const clock = installFakeClock();
  const log = recordingLogger();
  const reload = vi.fn(() => Promise.resolve());
  const recovery = new RendererRecovery({screenId: 'main', reload, log});
  return {clock, log, reload, recovery};
}

async function crashUntilLimited(
  recovery: RendererRecovery,
  clock: FakeClock,
): Promise<void> {
  for (let crash = 1; crash < CRASH_LIMIT; crash += 1) {
    recovery.crashed(CRASH);
    await clock.advance(RELAUNCH_DELAY_MS);
  }
  recovery.crashed(CRASH);
}

describe('RendererRecovery', () => {
  it('reloads quickly after the first crashes and logs the reason and exit code', async () => {
    const {clock, log, reload, recovery} = setUp();
    recovery.crashed(CRASH);
    expect(recovery.state).toBe('restarting');
    await clock.advance(RELAUNCH_DELAY_MS);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(recovery.state).toBe('restarting');
    recovery.pageDrawn();
    expect(recovery.state).toBe('running');
    expect(log.entries.slice(0, 2)).toEqual([
      {
        level: 'error',
        message: 'output window process gone',
        detail: {screen: 'main', ...CRASH},
      },
      {
        level: 'info',
        message: 'restarting an output window',
        detail: {screen: 'main'},
      },
    ]);
  });

  it('holds the limit after too many crashes in a minute', async () => {
    const {clock, log, reload, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    expect(recovery.state).toBe('limited');
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT - 1);
    expect(log.entries.at(-1)?.detail).toMatchObject({limit: CRASH_LIMIT});
  });

  it('waits 10, 20, 40, then 60 seconds between attempts that die again', async () => {
    const {clock, reload, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    const waits: number[] = [];
    let waited = 0;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const before = reload.mock.calls.length;
      while (reload.mock.calls.length === before) {
        await clock.advance(SECOND);
        waited += SECOND;
      }
      waits.push(waited / SECOND);
      waited = 0;
      recovery.crashed(CRASH);
    }
    expect(waits).toEqual([10, 20, 40, 60, 60]);
    expect(COOLDOWN_STEPS_MS).toEqual([10_000, 20_000, 40_000, 60_000]);
  });

  it('shows the live picture once an attempt draws, and ends the limit after a minute', async () => {
    const {clock, log, reload, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    await clock.advance(COOLDOWN_STEPS_MS[0] ?? 0);
    expect(recovery.state).toBe('limited');
    recovery.pageDrawn();
    expect(recovery.state).toBe('running');
    expect(log.messages('info')).toContain(
      'output window restart attempt works',
    );
    await clock.advance(SURVIVAL_MS);
    expect(log.messages('info').at(-1)).toBe(
      'output window restart limit ended',
    );
    recovery.crashed(CRASH);
    expect(recovery.state).toBe('restarting');
    await clock.advance(RELAUNCH_DELAY_MS);
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT + 1);
  });

  it('goes back to the empty picture when an attempt that drew dies within the minute', async () => {
    const {clock, reload, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    await clock.advance(COOLDOWN_STEPS_MS[0] ?? 0);
    recovery.pageDrawn();
    recovery.crashed(CRASH);
    expect(recovery.state).toBe('limited');
    await clock.advance((COOLDOWN_STEPS_MS[1] ?? 0) - 1);
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT);
    await clock.advance(1);
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT + 1);
  });

  it('starts an attempt at once on 다시 시도, but not while one is in progress', async () => {
    const {clock, reload, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    recovery.retry();
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT);
    recovery.retry();
    recovery.resume();
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT);
    await clock.advance(COOLDOWN_STEPS_MS[0] ?? 0);
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT);
  });

  it('starts no attempt on 다시 시도 while paused, and one on resume', async () => {
    const {clock, reload, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    recovery.pause();
    recovery.retry();
    recovery.retry();
    recovery.retry();
    await clock.advance(SURVIVAL_MS);
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT - 1);
    recovery.resume();
    recovery.retry();
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT);
  });

  it('does nothing on 다시 시도 when no limit holds', () => {
    const {reload, recovery} = setUp();
    recovery.retry();
    expect(reload).not.toHaveBeenCalled();
  });

  it('makes no attempts while paused and tries at once on resume', async () => {
    const {clock, reload, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    recovery.pause();
    await clock.advance(SURVIVAL_MS * 3);
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT - 1);
    recovery.resume();
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT);
  });

  it('waits for the next resume after an attempt dies while paused', async () => {
    const {clock, reload, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    await clock.advance(COOLDOWN_STEPS_MS[0] ?? 0);
    recovery.pause();
    recovery.crashed(CRASH);
    await clock.advance(SURVIVAL_MS * 3);
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT);
    recovery.resume();
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT + 1);
  });

  it('leaves no timer behind on dispose', async () => {
    const {clock, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    recovery.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('announces each change of its state once', async () => {
    const clock = installFakeClock();
    const changes: string[] = [];
    const recovery = new RendererRecovery({
      screenId: 'main',
      reload: vi.fn(() => Promise.resolve()),
      log: recordingLogger(),
      onStateChange: state => changes.push(state),
    });
    await crashUntilLimited(recovery, clock);
    recovery.pageDrawn();
    recovery.pageDrawn();
    expect(changes).toEqual(['restarting', 'limited', 'running']);
  });

  it('reloads again when a quick reload fails to load the page', async () => {
    const {clock, log, reload, recovery} = setUp();
    reload.mockRejectedValueOnce(LOAD_ERROR);
    recovery.crashed(CRASH);
    await clock.advance(RELAUNCH_DELAY_MS);
    expect(log.entries).toContainEqual({
      level: 'error',
      message: 'output window page did not load',
      detail: {screen: 'main', error: LOAD_ERROR},
    });
    expect(recovery.state).toBe('restarting');
    await clock.advance(RELAUNCH_DELAY_MS);
    expect(reload).toHaveBeenCalledTimes(2);
    recovery.pageDrawn();
    expect(recovery.state).toBe('running');
  });

  it('recovers after an attempt whose load is rejected', async () => {
    const {clock, log, reload, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    reload.mockRejectedValueOnce(LOAD_ERROR);
    await clock.advance(COOLDOWN_STEPS_MS[0] ?? 0);
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT);
    expect(recovery.state).toBe('limited');
    expect(log.messages('error')).toContain(
      'output window restart attempt failed',
    );
    await clock.advance(COOLDOWN_STEPS_MS[1] ?? 0);
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT + 1);
    recovery.pageDrawn();
    expect(recovery.state).toBe('running');
    await clock.advance(SURVIVAL_MS);
    expect(log.messages('info').at(-1)).toBe(
      'output window restart limit ended',
    );
  });

  it('fails an attempt that does not draw in time and tries again after the cool-down', async () => {
    const {clock, log, reload, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    await clock.advance(COOLDOWN_STEPS_MS[0] ?? 0);
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT);
    await clock.advance(DRAW_LIMIT_MS - 1);
    expect(log.messages('error')).not.toContain(
      'output window page did not draw in time',
    );
    await clock.advance(1);
    expect(log.messages('error')).toContain(
      'output window page did not draw in time',
    );
    expect(recovery.state).toBe('limited');
    await clock.advance(COOLDOWN_STEPS_MS[1] ?? 0);
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT + 1);
  });

  it('counts quick reloads that never draw toward the limit', async () => {
    const {clock, reload, recovery} = setUp();
    recovery.crashed(CRASH);
    for (let reloads = 1; reloads < CRASH_LIMIT; reloads += 1) {
      await clock.advance(RELAUNCH_DELAY_MS);
      expect(reload).toHaveBeenCalledTimes(reloads);
      await clock.advance(DRAW_LIMIT_MS);
    }
    expect(recovery.state).toBe('limited');
  });

  it('ends the limit only a minute after an attempt draws', async () => {
    const {clock, log, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    await clock.advance(COOLDOWN_STEPS_MS[0] ?? 0);
    await clock.advance(DRAW_LIMIT_MS - 1);
    recovery.pageDrawn();
    await clock.advance(SURVIVAL_MS - 1);
    expect(log.messages('info')).not.toContain(
      'output window restart limit ended',
    );
    await clock.advance(1);
    expect(log.messages('info').at(-1)).toBe(
      'output window restart limit ended',
    );
  });

  it('ignores the rejection of a load that a newer load replaced', async () => {
    const {clock, log, reload, recovery} = setUp();
    let rejectFirst: (error: unknown) => void = () => undefined;
    reload.mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => {
        rejectFirst = reject;
      }),
    );
    recovery.crashed(CRASH);
    await clock.advance(RELAUNCH_DELAY_MS);
    recovery.crashed(CRASH);
    await clock.advance(RELAUNCH_DELAY_MS);
    expect(reload).toHaveBeenCalledTimes(2);
    rejectFirst(LOAD_ERROR);
    await clock.advance(0);
    expect(log.messages('error')).not.toContain(
      'output window page did not load',
    );
    expect(recovery.state).toBe('restarting');
  });

  it('gives a hidden page no time limit to draw, and a full one on resume', async () => {
    const {clock, log, recovery} = setUp();
    recovery.crashed(CRASH);
    await clock.advance(RELAUNCH_DELAY_MS);
    recovery.pause();
    await clock.advance(DRAW_LIMIT_MS * 3);
    expect(log.messages('error')).not.toContain(
      'output window page did not draw in time',
    );
    recovery.resume();
    await clock.advance(DRAW_LIMIT_MS - 1);
    recovery.pageDrawn();
    await clock.advance(DRAW_LIMIT_MS);
    expect(log.messages('error')).not.toContain(
      'output window page did not draw in time',
    );
    expect(recovery.state).toBe('running');
  });
});
