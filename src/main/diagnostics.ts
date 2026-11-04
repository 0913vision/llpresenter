import {open} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {app, screen} from 'electron';
import {
  errorLinesOf,
  formatDiagnostics,
  type DiagnosticsInfo,
} from '@core/app/diagnostics';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import type {Logger} from './log';

/** How much of the end of the log is read for the last errors. */
const LOG_TAIL_BYTES = 128 * 1024;

async function logTail(file: string): Promise<string> {
  const handle = await open(file, 'r');
  try {
    const {size} = await handle.stat();
    const start = Math.max(0, size - LOG_TAIL_BYTES);
    const buffer = Buffer.alloc(size - start);
    await handle.read(buffer, 0, buffer.length, start);
    return buffer.toString('utf8');
  } finally {
    await handle.close();
  }
}

function field(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return Object.entries(value).find(([name]) => name === key)?.[1];
}

async function graphicsNames(): Promise<string[]> {
  const info: unknown = await app.getGPUInfo('basic');
  const devices = field(info, 'gpuDevice');
  const renderer = field(field(info, 'auxAttributes'), 'glRenderer');
  const names: string[] = [];
  if (typeof renderer === 'string') names.push(renderer);
  if (Array.isArray(devices) && names.length === 0) {
    for (const device of devices) {
      const vendor = field(device, 'vendorId');
      const id = field(device, 'deviceId');
      if (typeof vendor === 'number' && typeof id === 'number') {
        names.push(`vendor ${vendor.toString(16)} device ${id.toString(16)}`);
      }
    }
  }
  return names;
}

function screensOf(document: SettingsDocument | undefined) {
  if (document?.name !== 'screens') return [];
  return document.value.screens.map(entry => ({
    name: entry.name,
    kind: entry.kind,
    method: entry.method,
    monitorNumber: entry.display?.number,
  }));
}

/** What 진단 정보 needs from the app. */
export interface DiagnosticsSources {
  readonly logDirectory: string;
  /** The app data folder, whose path is masked in error lines. */
  readonly dataFolder: string;
  readonly screens: () => Promise<SettingsDocument | undefined>;
  readonly log: Logger;
}

/**
 * Collects the text 진단 정보 copies: the app and Windows versions, the
 * graphics adapter, the monitors, the screens of 화면 설정, and the last error
 * lines of the log. Anything that cannot be read is left out, never a failure.
 */
export function diagnosticsText({
  logDirectory,
  dataFolder,
  screens,
  log,
}: DiagnosticsSources): () => Promise<string> {
  return async () => {
    const home = homedir();
    const [graphics, errors, saved] = await Promise.all([
      graphicsNames().catch((error: unknown) => {
        log.warn('could not read the graphics adapter', error);
        return [];
      }),
      logTail(join(logDirectory, 'main.log')).then(
        text =>
          // NOTE(0913vision): The app data folder lies inside the home folder,
          // so it is masked first; the other order would leave `~` for it.
          errorLinesOf(text, [
            {path: dataFolder, mask: '<app data>'},
            {path: home, mask: '~'},
          ]),
        () => [],
      ),
      screens().catch(() => undefined),
    ]);
    const info: DiagnosticsInfo = {
      appVersion: app.getVersion(),
      windowsVersion: process.getSystemVersion(),
      graphics,
      monitors: screen.getAllDisplays().map((display, index) => ({
        number: index + 1,
        width: display.size.width,
        height: display.size.height,
        scaleFactor: display.scaleFactor,
      })),
      screens: screensOf(saved),
      errors,
    };
    return formatDiagnostics(info);
  };
}
