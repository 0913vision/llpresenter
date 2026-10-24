import {describe, expect, it, vi} from 'vitest';
import {installFakeClock, type FakeClock} from '../../../test/fake-clock';
import {recordingLogger} from '../displays/testing';
import {
  COOLDOWN_STEPS_MS,
  RELAUNCH_DELAY_MS,
  RendererRecovery,
  SURVIVAL_MS,
} from './rendererRecovery';
import {CRASH_LIMIT} from './restartBudget';

const CRASH = {reason: 'crashed', exitCode: -1073741819};
const SECOND = 1000;

function setUp() {
  const clock = installFakeClock();
  const log = recordingLogger();
  const reload = vi.fn();
  const recovery = new RendererRecovery({screenId: 'main', reload, log});
  return {clock, log, reload, recovery};
}

async function crashUntilLimited(
  recovery: RendererRecovery,
  clock: FakeClock,
): Promise<void> {
  for (let crash = 0; crash < CRASH_LIMIT; crash += 1) {
    recovery.crashed(CRASH);
    await clock.advance(RELAUNCH_DELAY_MS);
  }
}

describe('RendererRecovery', () => {
  it('reloads quickly after the first crashes and logs the reason and exit code', async () => {
    const {clock, log, reload, recovery} = setUp();
    recovery.crashed(CRASH);
    expect(recovery.state).toBe('restarting');
    await clock.advance(RELAUNCH_DELAY_MS);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(recovery.state).toBe('running');
    expect(log.entries[0]).toEqual({
      level: 'error',
      message: 'output window process gone, restarting it',
      detail: {screen: 'main', ...CRASH},
    });
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

  it('ends the limit when an attempt runs for a minute', async () => {
    const {clock, log, reload, recovery} = setUp();
    await crashUntilLimited(recovery, clock);
    await clock.advance(COOLDOWN_STEPS_MS[0] ?? 0);
    await clock.advance(SURVIVAL_MS);
    expect(recovery.state).toBe('running');
    expect(log.messages('info').at(-1)).toBe(
      'output window running again after the restart limit',
    );
    recovery.crashed(CRASH);
    expect(recovery.state).toBe('restarting');
    await clock.advance(RELAUNCH_DELAY_MS);
    expect(reload).toHaveBeenCalledTimes(CRASH_LIMIT + 1);
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
});
