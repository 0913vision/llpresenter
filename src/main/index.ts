import {app, protocol} from 'electron';
import {join} from 'node:path';
import {MEDIA_SCHEME} from '@contracts/ipc/mediaUrls';
import {createLogger, flushWithin} from './log';
import {applyUserDataOverride, defaultUserDataPath} from './userData';
import {windowModeFrom} from './windows/testWindows';
import {createSplash} from './windows/splash';

const BAD_ENVIRONMENT_EXIT_CODE = 1;
const LOG_FLUSH_LIMIT_MS = 2000;
const problem = applyUserDataOverride(
  process.env['LLP_USER_DATA'],
  path => app.setPath('userData', path),
  defaultUserDataPath(app.getPath('appData')),
);
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: {standard: true, secure: true, stream: true, corsEnabled: true},
  },
]);
const log = createLogger(join(app.getPath('userData'), 'logs'), {
  echo: !app.isPackaged,
});
process.on('uncaughtException', error =>
  log.error('uncaught exception', error),
);
process.on('unhandledRejection', reason =>
  log.error('unhandled rejection', reason),
);

if (problem !== null) {
  log.error('LLP_USER_DATA is not a usable app data folder; quitting', problem);
  const exit = (): void => app.exit(BAD_ENVIRONMENT_EXIT_CODE);
  flushWithin(log, LOG_FLUSH_LIMIT_MS).then(exit, exit);
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app
    .whenReady()
    .then(async () => {
      const readyUptimeMs = Math.round(process.uptime() * 1000);
      const mode = windowModeFrom(process.env, app.isPackaged);
      const splash = createSplash(mode);
      await new Promise<void>(resolve => splash.once('ready-to-show', resolve));
      const paintUptimeMs = Math.round(process.uptime() * 1000);
      log.info('launch window first paint', {
        readyUptimeMs,
        paintUptimeMs,
        afterReadyMs: paintUptimeMs - readyUptimeMs,
      });
      try {
        const application = await import('./application');
        application.start(splash, mode, log);
      } catch (error: unknown) {
        log.error('failed to load application', error);
        if (!splash.isDestroyed()) splash.close();
        app.quit();
      }
    })
    .catch((error: unknown) => {
      log.error('failed to create launch window', error);
      app.quit();
    });
}
