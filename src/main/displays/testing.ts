import type {Logger} from '../log';
import {numberMonitors, type DisplayInfo, type Monitor} from './monitor';
import type {Size} from './rect';

export const FULL_HD: Size = {width: 1920, height: 1080};

const TASKBAR_HEIGHT = 40;

/** A monitor for a test: where it sits and what it is. */
export interface DisplaySpec {
  readonly id: number;
  readonly x?: number;
  readonly y?: number;
  readonly size?: Size;
  readonly name?: string;
  readonly primary?: boolean;
}

/** A monitor as the operating system would report it, with a taskbar at the bottom. */
export function displayInfo({
  id,
  x = 0,
  y = 0,
  size = FULL_HD,
  name = `Monitor ${id}`,
  primary = false,
}: DisplaySpec): DisplayInfo {
  return {
    id,
    name,
    bounds: {x, y, ...size},
    workArea: {x, y, width: size.width, height: size.height - TASKBAR_HEIGHT},
    scaleFactor: 1,
    primary,
  };
}

/** Numbered monitors, as the display registry gives them. */
export function monitorsOf(
  ...specs: readonly DisplaySpec[]
): readonly Monitor[] {
  return numberMonitors(specs.map(displayInfo));
}

/** The monitor with the id; fails the test when there is none. */
export function monitorById(monitors: readonly Monitor[], id: number): Monitor {
  const monitor = monitors.find(candidate => candidate.id === id);
  if (monitor === undefined) throw new Error(`no test monitor ${id}`);
  return monitor;
}

/** One line a {@link RecordingLogger} received. */
export interface LogEntry {
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly detail: unknown;
}

/** A logger that keeps what it receives, for tests to read. */
export interface RecordingLogger extends Logger {
  readonly entries: readonly LogEntry[];
  messages(level: LogEntry['level']): readonly string[];
}

export function recordingLogger(): RecordingLogger {
  const entries: LogEntry[] = [];
  const record =
    (level: LogEntry['level']) =>
    (message: string, detail?: unknown): void => {
      entries.push({level, message, detail});
    };
  return {
    entries,
    messages: level =>
      entries
        .filter(entry => entry.level === level)
        .map(({message}) => message),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    flush: () => Promise.resolve(),
  };
}
