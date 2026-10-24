import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp, readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {judgeOptionsFor, judgeRun} from './judge.mts';
import {makeSoakClip, prepareSoakMedia} from './media.mts';
import {parseRecord} from './record.mts';
import {formatReport} from './report.mts';

const MS_PER_MINUTE = 60_000;
const DEFAULT_MINUTES = 60;
const QUIT_GRACE_MS = 2 * MS_PER_MINUTE;
const FAILURE_EXIT_CODE = 1;
const USAGE_EXIT_CODE = 2;

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const BUILT_MAIN = join(REPO_ROOT, 'out', 'main', 'index.js');
const RECORD_FILE_NAME = 'soak.jsonl';
const TEST_WINDOWS_OFFSCREEN = 'offscreen';
const NODE_OPTIONS = 'NODE_OPTIONS';
const INSPECTOR_FLAG =
  /^--(?:inspect(?:-brk|-port|-wait|-publish-uid)?|debug-port)(?:=|$)/;

/** What the soak runner was asked to do. */
export type SoakCommand =
  | {readonly kind: 'run'; readonly minutes: number}
  | {
      readonly kind: 'judge';
      readonly recordPath: string;
      readonly minutes: number;
    }
  | {readonly kind: 'usage'; readonly message: string};

const USAGE = [
  'Usage: npm run soak -- [--minutes <n>] [--judge <record.jsonl>]',
  '  --minutes  how long the app runs and the record must cover (default 60)',
  '  --judge    judge an existing record instead of starting the app',
].join('\n');

interface SoakOptions {
  readonly minutes?: string | undefined;
  readonly judge?: string | undefined;
}

function readOptions(args: readonly string[]): SoakOptions | string {
  try {
    return parseArgs({
      args: [...args],
      options: {minutes: {type: 'string'}, judge: {type: 'string'}},
      strict: true,
    }).values;
  } catch (error) {
    return error instanceof Error ? error.message : 'bad arguments';
  }
}

/** Reads the command line. Never throws; a bad argument becomes `usage`. */
export function parseSoakArgs(args: readonly string[]): SoakCommand {
  const options = readOptions(args);
  if (typeof options === 'string') {
    return {
      kind: 'usage',
      message: `${options}
${USAGE}`,
    };
  }
  const minutes = Number(options.minutes ?? DEFAULT_MINUTES);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return {
      kind: 'usage',
      message: `--minutes must be above 0.
${USAGE}`,
    };
  }
  if (options.judge === undefined) return {kind: 'run', minutes};
  return {kind: 'judge', recordPath: resolve(options.judge), minutes};
}

function electronBinary(): string {
  // NOTE(0913vision): In Node, the electron package exports the path to its
  // binary as a plain string.
  const exported: unknown = createRequire(import.meta.url)('electron');
  if (typeof exported !== 'string') {
    throw new Error('the electron package did not export a binary path');
  }
  return exported;
}

/** Where one soak run keeps its files, and how long the app runs. */
export interface SoakRun {
  readonly userData: string;
  readonly recordPath: string;
  readonly durationMs: number;
  readonly mediaId: string;
}

/**
 * Drops the flags that attach an inspector (`--inspect`, `--inspect-brk`,
 * `--inspect-port`, and the like) from a `NODE_OPTIONS` value.
 */
export function withoutInspectorFlags(nodeOptions: string): string {
  return nodeOptions
    .split(/\s+/)
    .filter(flag => flag !== '' && !INSPECTOR_FLAG.test(flag))
    .join(' ');
}

// NOTE(0913vision): qa measured the main process's memory growing 4.9 to
// 7.9 MB in 30 minutes with an inspector attached, and flat without one, so a
// soak run never passes one on. Windows can hold NODE_OPTIONS under two
// spellings, so every spelling is checked.
function withoutInspector(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(base)) {
    if (name.toLowerCase() !== NODE_OPTIONS.toLowerCase()) {
      env[name] = value;
      continue;
    }
    const kept = withoutInspectorFlags(value ?? '');
    if (kept !== '') env[NODE_OPTIONS] = kept;
  }
  return env;
}

/**
 * The variables the app starts with for a soak run. `LLP_TEST_WINDOWS` keeps
 * every window off the user's screen, and `NODE_OPTIONS` loses any flag that
 * would attach an inspector.
 */
export function soakEnvironment(
  run: SoakRun,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...withoutInspector(base),
    LLP_USER_DATA: run.userData,
    LLP_SOAK_RECORD: run.recordPath,
    LLP_SOAK_EXIT_MS: String(run.durationMs),
    LLP_SOAK_MEDIA_ID: run.mediaId,
    LLP_TEST_WINDOWS: TEST_WINDOWS_OFFSCREEN,
  };
}

async function runApp(minutes: number): Promise<string> {
  const userData = await mkdtemp(join(tmpdir(), 'llp-soak-'));
  const recordPath = join(userData, RECORD_FILE_NAME);
  const durationMs = minutes * MS_PER_MINUTE;
  const electron = electronBinary();
  console.log(`Making the soak clip in ${userData}`);
  const mediaId = await prepareSoakMedia(userData, file =>
    makeSoakClip(electron, file, userData),
  );
  console.log(`Running the app for ${minutes} min. Record: ${recordPath}`);
  const child = spawn(electron, [REPO_ROOT], {
    stdio: 'inherit',
    windowsHide: true,
    env: soakEnvironment({userData, recordPath, durationMs, mediaId}),
  });
  let timedOut = false;
  const watchdog = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, durationMs + QUIT_GRACE_MS);
  try {
    await new Promise<void>((resolveExit, rejectExit) => {
      child.once('error', rejectExit);
      child.once('exit', code => {
        if (code === 0) resolveExit();
        else if (timedOut) {
          rejectExit(new Error('the app did not quit in time'));
        } else {
          rejectExit(new Error(`the app exited with code ${code ?? 'none'}`));
        }
      });
    });
  } finally {
    clearTimeout(watchdog);
  }
  return recordPath;
}

async function judgeRecord(
  recordPath: string,
  minutes: number,
): Promise<boolean> {
  if (!existsSync(recordPath)) {
    console.error(
      `No record at ${recordPath}. The app writes it when LLP_SOAK_RECORD is set.`,
    );
    return false;
  }
  const {samples, problems} = parseRecord(await readFile(recordPath, 'utf8'));
  const verdict = judgeRun(samples, judgeOptionsFor(minutes * MS_PER_MINUTE));
  console.log(formatReport(verdict, problems));
  return verdict.passed;
}

async function main(): Promise<void> {
  const command = parseSoakArgs(process.argv.slice(2));
  if (command.kind === 'usage') {
    console.error(command.message);
    process.exitCode = USAGE_EXIT_CODE;
    return;
  }
  if (command.kind === 'run' && !existsSync(BUILT_MAIN)) {
    console.error(
      'Run "npm run build" first; the soak test starts the built app.',
    );
    process.exitCode = USAGE_EXIT_CODE;
    return;
  }
  const recordPath =
    command.kind === 'run' ? await runApp(command.minutes) : command.recordPath;
  const passed = await judgeRecord(recordPath, command.minutes);
  process.exitCode = passed ? 0 : FAILURE_EXIT_CODE;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => {
    console.error('Soak test failed to run:', error);
    process.exitCode = FAILURE_EXIT_CODE;
  });
}
