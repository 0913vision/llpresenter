import {appendFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {app, webContents} from 'electron';
import type {Logger} from '../log';
import {
  pageProcessName,
  processSamples,
  readSoakSettings,
  sampleLine,
  startSoakRecording,
  type OutputFrameRate,
  type SoakSettings,
} from './recorder';

export {registerSoakScenario} from './scenario';

/** Where the recorder reads what it doesn't measure itself. */
export interface SoakSources {
  /**
   * Each output screen's last frame rate. Without it, the record lists no
   * outputs.
   */
  readonly frameRates?: () => readonly OutputFrameRate[];
  readonly env?: NodeJS.ProcessEnv;
}

function rendererNames(): Map<number, string> {
  const names = new Map<number, string>();
  for (const contents of webContents.getAllWebContents()) {
    const name = pageProcessName(contents.getURL());
    if (name !== null) names.set(contents.getOSProcessId(), name);
  }
  return names;
}

function sampleApp(
  elapsedMs: number,
  frameRates: () => readonly OutputFrameRate[],
): string {
  const names = rendererNames();
  const processes = processSamples(
    app.getAppMetrics(),
    pid => names.get(pid) ?? null,
  );
  return sampleLine(elapsedMs, processes, frameRates());
}

function startRecording(
  log: Logger,
  settings: SoakSettings,
  frameRates: () => readonly OutputFrameRate[],
): () => Promise<void> {
  log.info('soak recording started', settings);
  return startSoakRecording({
    settings,
    sample: elapsedMs => sampleApp(elapsedMs, frameRates),
    append: line => appendFile(settings.recordPath, line, 'utf8'),
    quit: () => app.quit(),
    now: () => performance.now(),
    log,
  });
}

/**
 * Records memory and output frame rates for the soak test when
 * `LLP_SOAK_RECORD` names a record file, and quits after `LLP_SOAK_EXIT_MS`
 * once the record is written. Does nothing otherwise, and logs an error for an
 * unusable exit time. Call it once the app is ready.
 *
 * @returns a function that stops the recording and resolves once every queued
 *   line is written
 */
export function registerSoakRecorder(
  log: Logger,
  {frameRates = () => [], env = process.env}: SoakSources = {},
): () => Promise<void> {
  const result = readSoakSettings(env);
  switch (result.kind) {
    case 'off':
      return () => Promise.resolve();
    case 'invalid':
      log.error('soak recording not started', result.reason);
      return () => Promise.resolve();
    case 'on':
      return startRecording(log, result.settings, frameRates);
  }
}
