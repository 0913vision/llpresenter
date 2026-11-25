import {afterEach, expect, it, vi} from 'vitest';
import type {ShutdownCoordinator} from '@main/base/shutdown';
import {
  handOverToInstaller,
  type InstallHandoffOptions,
} from '@main/update/installHandoff';

type QuitForUpdate = ShutdownCoordinator['quitForUpdate'];
type Checks = Parameters<QuitForUpdate>[2];

afterEach(() => {
  vi.useRealTimers();
});

/** A handoff whose quit runs `quit` with the checks it was given. */
function setup(
  quit: (checks: Checks) => Promise<boolean>,
  {
    saved = true,
    controlClosed = false,
  }: {readonly saved?: boolean; readonly controlClosed?: boolean} = {},
) {
  const steps: string[] = [];
  const step =
    <T>(name: string, value: T) =>
    async (): Promise<T> => {
      steps.push(name);
      return value;
    };
  const options = {
    control: {
      webContents: {
        isDestroyed: () => controlClosed,
        executeJavaScript: vi.fn(step('painted', undefined)),
      },
    },
    shutdown: {
      quitForUpdate: vi.fn<QuitForUpdate>((_install, _allowed, checks) =>
        quit(checks),
      ),
    },
    savePending: vi.fn(step('saved', saved)),
    verifyClean: vi.fn(step('clean', true)),
    prepareRestart: vi.fn(step('restart recorded', true)),
    cancelRestart: vi.fn(step('restart taken back', undefined)),
    resumeAfterCancelledInstall: vi.fn(() => {
      steps.push('resumed');
    }),
  } satisfies InstallHandoffOptions;
  const handOver = (): Promise<boolean> =>
    handOverToInstaller(options, {
      install: async () => undefined,
      version: '2.0.0',
      onHandoff: () => {
        steps.push('handoff shown');
      },
    });
  return {options, steps, handOver};
}

/** A quit that goes ahead: saves, shows the handoff, then quits. */
async function quitting(checks: Checks): Promise<boolean> {
  if (!(await checks.savePending())) return false;
  await checks.beforeShutdown?.();
  return true;
}

it('saves, records the restart and paints the handoff before the installer runs', async () => {
  const {options, steps, handOver} = setup(quitting);
  expect(await handOver()).toBe(true);
  expect(steps).toEqual([
    'saved',
    'restart recorded',
    'handoff shown',
    'painted',
  ]);
  expect(options.prepareRestart).toHaveBeenCalledWith('2.0.0');
  expect(options.shutdown.quitForUpdate.mock.calls[0]?.[2].verifyClean).toBe(
    options.verifyClean,
  );
});

it('records no restart when the changes could not be saved, and goes on', async () => {
  const {steps, handOver} = setup(quitting, {saved: false});
  expect(await handOver()).toBe(false);
  expect(steps).toEqual(['saved', 'restart taken back', 'resumed']);
});

it('takes the restart back and goes on when the quit does not go ahead', async () => {
  const {steps, handOver} = setup(async checks => {
    await checks.savePending();
    return false;
  });
  expect(await handOver()).toBe(false);
  expect(steps).toEqual([
    'saved',
    'restart recorded',
    'restart taken back',
    'resumed',
  ]);
});

it('takes back a restart recorded after the quit was already refused', async () => {
  let saving: Promise<boolean> = Promise.resolve(true);
  const {options, steps, handOver} = setup(async checks => {
    saving = checks.savePending();
    return false;
  });
  let record: (prepared: boolean) => void = () => undefined;
  options.prepareRestart.mockImplementation(
    () =>
      new Promise(resolve => {
        record = resolve;
      }),
  );
  expect(await handOver()).toBe(false);
  await vi.waitFor(() => expect(options.prepareRestart).toHaveBeenCalled());
  record(true);
  expect(await saving).toBe(false);
  expect(options.cancelRestart).toHaveBeenCalledTimes(2);
  expect(steps.at(-1)).toBe('restart taken back');
});

it('takes the restart back and goes on when the quit fails', async () => {
  const {steps, handOver} = setup(() => Promise.reject(new Error('locked')));
  await expect(handOver()).rejects.toThrow('locked');
  expect(steps).toEqual(['restart taken back', 'resumed']);
});

it('waits for no paint of a closed control window, and at most half a second for an open one', async () => {
  const closed = setup(quitting, {controlClosed: true});
  expect(await closed.handOver()).toBe(true);
  expect(
    closed.options.control.webContents.executeJavaScript,
  ).not.toHaveBeenCalled();

  vi.useFakeTimers();
  const stuck = setup(quitting);
  stuck.options.control.webContents.executeJavaScript.mockReturnValue(
    new Promise(() => undefined),
  );
  let done = false;
  const handing = stuck.handOver().then(() => {
    done = true;
  });
  await vi.advanceTimersByTimeAsync(499);
  expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(done).toBe(true);
  await handing;
});
