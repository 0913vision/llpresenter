/** What 진단 정보 gathers; nothing in it names a person or a file of theirs. */
export interface DiagnosticsInfo {
  readonly appVersion: string;
  /** The Windows version, such as `10.0.19045`. */
  readonly windowsVersion: string;
  /** The graphics adapter names. */
  readonly graphics: readonly string[];
  readonly monitors: ReadonlyArray<{
    readonly number: number;
    readonly width: number;
    readonly height: number;
    readonly scaleFactor: number;
  }>;
  /** Each screen of 화면 설정 and the monitor number it uses, if any. */
  readonly screens: ReadonlyArray<{
    readonly name: string;
    readonly kind: string;
    readonly method: string;
    readonly monitorNumber?: number | undefined;
  }>;
  /** The last error lines of the log. */
  readonly errors: readonly string[];
}

/** How many error lines 진단 정보 keeps. */
export const DIAGNOSTICS_ERROR_LINES = 10;

/** The longest an error line stays, so a pasted text stays small. */
export const DIAGNOSTICS_LINE_LIMIT = 300;

/** A folder whose path a log line must not carry, and what replaces it. */
export interface MaskedFolder {
  readonly path: string;
  readonly mask: string;
}

const BACKSLASH = String.fromCharCode(92);

function escapedForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** What finds a folder in a log line, whatever the case or the slashes. */
type Maskers = ReadonlyArray<{readonly pattern: RegExp; readonly mask: string}>;

function maskersOf(folders: readonly MaskedFolder[]): Maskers {
  return folders
    .filter(({path}) => path !== '')
    .flatMap(({path, mask}) =>
      [
        path,
        path.replaceAll(BACKSLASH, '/'),
        path.replaceAll(BACKSLASH, BACKSLASH + BACKSLASH),
      ].map(form => ({
        pattern: new RegExp(escapedForPattern(form), 'gi'),
        mask,
      })),
    );
}

function masked(line: string, maskers: Maskers): string {
  return maskers.reduce(
    (text, {pattern, mask}) => text.replace(pattern, mask),
    line,
  );
}

/**
 * Replaces each folder in a log line, whatever the case, written with
 * backslashes, with slashes, or escaped for JSON.
 */
export function withoutFolders(
  line: string,
  folders: readonly MaskedFolder[],
): string {
  return masked(line, maskersOf(folders));
}

/** The text 진단 정보 copies. */
export function formatDiagnostics(info: DiagnosticsInfo): string {
  const lines = [
    `LoveLight ${info.appVersion}`,
    `Windows ${info.windowsVersion}`,
    `Graphics: ${info.graphics.length === 0 ? 'unknown' : info.graphics.join(', ')}`,
    'Monitors:',
    ...info.monitors.map(
      monitor =>
        `  ${monitor.number}: ${monitor.width}x${monitor.height} at ${Math.round(monitor.scaleFactor * 100)}%`,
    ),
    'Screens:',
    ...info.screens.map(
      screen =>
        `  ${screen.name} (${screen.kind}, ${screen.method})${
          screen.monitorNumber === undefined
            ? ''
            : ` on monitor ${screen.monitorNumber}`
        }`,
    ),
    `Last errors (${Math.min(info.errors.length, DIAGNOSTICS_ERROR_LINES)}):`,
    ...info.errors
      .slice(-DIAGNOSTICS_ERROR_LINES)
      .map(line => `  ${line.slice(0, DIAGNOSTICS_LINE_LIMIT)}`),
  ];
  return `${lines.join('\n')}\n`;
}

/** The last error lines of a log text, with the given folders masked. */
export function errorLinesOf(
  logText: string,
  folders: readonly MaskedFolder[],
): string[] {
  const maskers = maskersOf(folders);
  return logText
    .split('\n')
    .filter(line => line.includes(' ERROR '))
    .slice(-DIAGNOSTICS_ERROR_LINES)
    .map(line => masked(line, maskers));
}
