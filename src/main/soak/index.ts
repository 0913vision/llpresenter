import {appendFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {app, webContents} from 'electron';
import type {Logger} from '../log';
import {
  pageProcessName,
  processSamples,
  sampleLine,
  soakSettings,
  startSoakRecording,
} from './recorder';

function rendererNames(): Map<number, string> {
  const names = new Map<number, string>();
  for (const contents of webContents.getAllWebContents()) {
    const name = pageProcessName(contents.getURL());
    if (name !== null) names.set(contents.getOSProcessId(), name);
  }
  return names;
}

function sampleApp(elapsedMs: number): string {
  const names = rendererNames();
  const processes = processSamples(
    app.getAppMetrics(),
    pid => names.get(pid) ?? null,
  );
  return sampleLine(elapsedMs, processes);
}

/**
 * Records memory for the soak test when `LLP_SOAK_RECORD` names a record file,
 * and quits after `LLP_SOAK_EXIT_MS`. Does nothing otherwise. Call it once the
 * app is ready.
 *
 * @returns a function that stops the recording
 */
export function registerSoakRecorder(
  log: Logger,
  env: NodeJS.ProcessEnv = process.env,
): () => void {
  const settings = soakSettings(env);
  if (settings === null) return () => undefined;
  log.info('soak recording started', settings);
  return startSoakRecording({
    settings,
    sample: sampleApp,
    append: line => appendFile(settings.recordPath, line, 'utf8'),
    quit: () => app.quit(),
    now: () => performance.now(),
    log,
  });
}
