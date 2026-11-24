import {app, type BrowserWindow} from 'electron';
import {join} from 'node:path';
import {isAnyOutputOn} from '@core/schema/live/live';
import type {createLogger} from '../base/log';
import {registerProblemFeed} from '../base/problemFeed';
import type {ShutdownCoordinator} from '../base/shutdown';
import type {WindowMode} from '../base/renderers/windowMode';
import {openRecoverySession} from '../live/recovery/session';
import {serviceStandby} from '../live/item/serviceStandby';
import {LiveStore} from '../live/store';
import {openAppConfig} from '../store/locations/appConfigFile';
import {LaunchIdle} from '../store/launchIdle';
import {registerStore} from '../store/register';
import {registerUiZoom} from '../store/settings/uiZoom';
import {registerUiState} from '../uiState/register';
import {cancelRestartOutputs} from '../update/restartOutputs';
import {LaunchBar} from '../windows/splash';
import {LaunchProgress} from './launchProgress';

const UI_STATE_FILE = 'app.json';
const RECOVERY_FOLDER = 'recovery';

/** What the app starts with. */
export interface LaunchOptions {
  readonly splash: BrowserWindow;
  readonly windowMode: WindowMode;
  readonly log: ReturnType<typeof createLogger>;
  readonly shutdown: ShutdownCoordinator;
}

/** What every other part of the app is built on. */
export type Foundation = Awaited<ReturnType<typeof openFoundation>>;

/** Opens the app's files, its live state, and its problem cards. */
export async function openFoundation({
  splash,
  windowMode,
  log,
  shutdown,
}: LaunchOptions) {
  const recoveryFolder = join(app.getPath('userData'), RECOVERY_FOLDER);
  const session = await openRecoverySession({folder: recoveryFolder, log});
  if (session.crashed) {
    await cancelRestartOutputs(recoveryFolder).catch((error: unknown) =>
      log.warn('Could not discard update restart screens', error),
    );
  }
  const appConfig = await openAppConfig({
    file: join(app.getPath('userData'), UI_STATE_FILE),
    log,
  });
  const ui = registerUiState(appConfig, log);
  const zoom = registerUiZoom(appConfig, log);
  const launch = new LaunchProgress({
    splash,
    openBar: plan => new LaunchBar(splash, plan),
    config: appConfig,
    log,
  });
  const store = new LiveStore();
  const launchIdle = new LaunchIdle();
  launchIdle.ready
    .then(ready => {
      if (ready && app.isPackaged && windowMode === 'offscreen') {
        log.info('installer smoke ready');
      }
    })
    .catch((error: unknown) =>
      log.warn('Could not record launch readiness', error),
    );
  shutdown.add({
    name: 'cancel deferred launch work',
    run: () => launchIdle.dispose(),
  });
  const problems = registerProblemFeed({source: store, log});
  launch.onFailure(tasks => {
    problems.feed.report({kind: 'launch-failed', tasks: [...tasks]});
  });
  const data = registerStore({
    log,
    launchIdle: launchIdle.ready,
    isAnyOutputOn: () => isAnyOutputOn(store.state),
    onServiceChanged: () => serviceStandby(store),
    appConfig,
    problems: problems.feed,
    launch,
  });
  return {
    windowMode,
    log,
    shutdown,
    recoveryFolder,
    session,
    appConfig,
    ui,
    zoom,
    launch,
    launchIdle,
    store,
    problems,
    data,
  };
}
