import type {ShutdownCoordinator} from '../base/shutdown';

/** What handing the app over to an update's installer uses. */
export interface InstallHandoffOptions {
  readonly control: {
    readonly webContents: {
      isDestroyed(): boolean;
      executeJavaScript?(code: string): Promise<unknown>;
    };
  };
  readonly shutdown: Pick<ShutdownCoordinator, 'quitForUpdate'>;
  readonly savePending: () => Promise<boolean>;
  readonly verifyClean: () => Promise<boolean>;
  /** Records the outputs to start again with after `version` is installed. */
  readonly prepareRestart: (version: string) => Promise<boolean>;
  readonly cancelRestart: () => Promise<void>;
  readonly resumeAfterCancelledInstall: () => void;
}

/** Resolves once the control window has painted twice, or after 250 ms. */
const PAINTED_SCRIPT =
  'new Promise(resolve => { requestAnimationFrame(() => requestAnimationFrame(resolve)); setTimeout(resolve, 250); })';
/** The longest the handoff waits for the control window to paint. */
const PAINT_LIMIT_MS = 500;

/**
 * Quits the app so the installer of `version` runs: saves every change,
 * records the outputs to start again with, and lets the control window paint
 * its handoff screen once. When the quit does not go ahead, the recorded
 * restart is taken back and the app goes on.
 *
 * @returns Whether the app quits for the installer.
 */
export async function handOverToInstaller(
  options: InstallHandoffOptions,
  {
    install,
    version,
    onHandoff,
  }: {
    readonly install: () => Promise<void>;
    readonly version: string;
    /** Shows the control window's handoff screen. */
    readonly onHandoff: () => void;
  },
): Promise<boolean> {
  let accepted = false;
  let refused = false;
  // NOTE(0913vision): Saving runs inside the quit and may still run once the
  // quit was refused, so it asks again after each wait.
  const isRefused = (): boolean => refused;
  const saveAndRecordRestart = async (): Promise<boolean> => {
    if (!(await options.savePending()) || isRefused()) return false;
    const prepared = await options.prepareRestart(version);
    // NOTE(0913vision): A restart recorded after the refusal is taken back
    // here, after the one in `finally`.
    if (isRefused()) {
      await options.cancelRestart();
      return false;
    }
    return prepared;
  };
  try {
    accepted = await options.shutdown.quitForUpdate(install, () => true, {
      savePending: saveAndRecordRestart,
      beforeShutdown: async () => {
        onHandoff();
        await handoffPainted(options.control.webContents);
      },
      verifyClean: options.verifyClean,
    });
    return accepted;
  } finally {
    if (!accepted) {
      refused = true;
      await options.cancelRestart();
      options.resumeAfterCancelledInstall();
    }
  }
}

async function handoffPainted(
  contents: InstallHandoffOptions['control']['webContents'],
): Promise<void> {
  if (contents.isDestroyed()) return;
  let limit: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      contents.executeJavaScript?.(PAINTED_SCRIPT),
      new Promise<void>(resolve => {
        limit = setTimeout(resolve, PAINT_LIMIT_MS);
      }),
    ]);
  } finally {
    clearTimeout(limit);
  }
}
