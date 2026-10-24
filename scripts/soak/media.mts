import {spawn, type ChildProcessByStdio} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Readable} from 'node:stream';
import {isJsonObject} from '../json.mts';
import {killProcessTree} from '../process-tree.mts';
import {
  SOAK_CLIP,
  type Checked,
  type ClipOptions,
  type ClipSummary,
} from './clip-frames.mts';

/** The soak clip's id in the run's media library. */
export const SOAK_MEDIA_ID = '5a0c4b3e-7d21-4f6a-9b8c-2e1f0d3c4b5a';

const CLIP_FILE_NAME = 'soak-loop.webm';
const CLIP_NAME = '소크 시험 배경';
const DATA_FOLDER = 'LoveLight';
const MEDIA_FOLDER = '미디어';
const SETTINGS_FOLDER = '설정';
const MEDIA_LIST_FILE = 'media.json';
const CLIP_MAKER_DATA = '.clip-maker';
const CLIP_MAKER_MAIN = join(import.meta.dirname, 'clip', 'main.mts');
const MS_PER_SECOND = 1000;
// NOTE(0913vision): The clip took 15 s to make at 100% CPU; three minutes ends a
// stuck encoder or seek without failing a slow machine.
const CLIP_DEADLINE_MS = 3 * 60 * MS_PER_SECOND;
const MAX_MAKER_OUTPUT_CHARS = 64 * 1024;

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Reads the clip maker's last line of output. */
export function parseClipSummary(line: string): Checked<ClipSummary> {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return {ok: false, reason: `the clip maker printed no summary: ${line}`};
  }
  if (!isJsonObject(value)) {
    return {ok: false, reason: 'the clip summary is not an object'};
  }
  const {file, bytes, frames, durationMs} = value;
  if (
    typeof file !== 'string' ||
    !isCount(bytes) ||
    !isCount(frames) ||
    !isCount(durationMs)
  ) {
    return {ok: false, reason: `the clip summary is incomplete: ${line}`};
  }
  return {ok: true, value: {file, bytes, frames, durationMs}};
}

/**
 * The run's `media.json`: the soak clip only, looping and filling the screen,
 * in the 설정 folder's media list format.
 */
export function soakMediaList(
  clip: ClipSummary,
  options: ClipOptions = SOAK_CLIP,
) {
  return {
    format: 'llmedia',
    schemaVersion: 1,
    items: [
      {
        id: SOAK_MEDIA_ID,
        name: CLIP_NAME,
        kind: 'video',
        file: CLIP_FILE_NAME,
        size: clip.bytes,
        duration: clip.durationMs / MS_PER_SECOND,
        width: options.width,
        height: options.height,
        props: {end: 'loop', fit: 'fill'},
      },
    ],
    playlists: [],
    audioPlaylists: [],
  };
}

/**
 * Puts the soak clip and a `media.json` that lists it into the data folder of
 * a new `LLP_USER_DATA` folder, before the app starts.
 *
 * @param makeClip - makes the clip at the given path
 * @returns the clip's media id, for `LLP_SOAK_MEDIA_ID`
 */
export async function prepareSoakMedia(
  userData: string,
  makeClip: (file: string) => Promise<ClipSummary>,
): Promise<string> {
  const dataRoot = join(userData, DATA_FOLDER);
  const mediaFolder = join(dataRoot, MEDIA_FOLDER);
  const settingsFolder = join(dataRoot, SETTINGS_FOLDER);
  await mkdir(mediaFolder, {recursive: true});
  await mkdir(settingsFolder, {recursive: true});
  const clip = await makeClip(join(mediaFolder, CLIP_FILE_NAME));
  const list = `${JSON.stringify(soakMediaList(clip), null, 2)}\n`;
  await writeFile(join(settingsFolder, MEDIA_LIST_FILE), list, 'utf8');
  return SOAK_MEDIA_ID;
}

/** A command that makes the clip and prints its summary as the last line. */
export interface ClipMakerCommand {
  readonly file: string;
  readonly args: readonly string[];
  readonly deadlineMs: number;
}

function summaryFrom(output: string, exitCode: number | null): ClipSummary {
  const summary = parseClipSummary(output.trim().split('\n').at(-1) ?? '');
  if (exitCode === 0 && summary.ok) return summary.value;
  const reason = summary.ok
    ? `exit code ${exitCode ?? 'none'}`
    : summary.reason;
  throw new Error(`the soak clip could not be made: ${reason}`);
}

function stopMaker(maker: ChildProcessByStdio<null, Readable, null>): void {
  maker.stdout.destroy();
  maker.unref();
  const {pid} = maker;
  if (pid === undefined) return;
  killProcessTree(pid).then(
    result => {
      if (!result.ok) {
        console.error(`could not stop the clip maker: ${result.reason}`);
      }
    },
    (error: unknown) => console.error('could not stop the clip maker:', error),
  );
}

/**
 * Runs a clip maker and reads its summary. A maker that runs past
 * `deadlineMs` is stopped with every process it started, and only the last
 * 64 KB of what it prints is kept.
 */
export function runClipMaker(command: ClipMakerCommand): Promise<ClipSummary> {
  return new Promise((resolve, reject) => {
    const maker = spawn(command.file, [...command.args], {
      stdio: ['ignore', 'pipe', 'inherit'],
      windowsHide: true,
    });
    let output = '';
    maker.stdout.setEncoding('utf8');
    maker.stdout.on('data', (text: string) => {
      output = (output + text).slice(-MAX_MAKER_OUTPUT_CHARS);
    });
    const deadline = setTimeout(() => {
      stopMaker(maker);
      const seconds = command.deadlineMs / MS_PER_SECOND;
      reject(new Error(`the clip maker did not finish within ${seconds} s`));
    }, command.deadlineMs);
    maker.once('error', error => {
      clearTimeout(deadline);
      reject(error);
    });
    maker.once('close', exitCode => {
      clearTimeout(deadline);
      try {
        resolve(summaryFrom(output, exitCode));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

/**
 * Makes the soak clip with the clip maker (`clip/main.mts`) in Electron. It
 * draws in a window that is never shown and keeps Electron's caches in
 * `userData`.
 */
export function makeSoakClip(
  electron: string,
  file: string,
  userData: string,
): Promise<ClipSummary> {
  return runClipMaker({
    file: electron,
    args: [CLIP_MAKER_MAIN, file, join(userData, CLIP_MAKER_DATA)],
    deadlineMs: CLIP_DEADLINE_MS,
  });
}
