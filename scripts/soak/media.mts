import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {isJsonObject} from '../json.mts';
import {SOAK_CLIP, type Checked, type ClipOptions} from './clip-frames.mts';

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

/** What the clip maker reports about the clip it made. */
export interface ClipSummary {
  readonly file: string;
  readonly bytes: number;
  readonly frames: number;
  readonly durationMs: number;
}

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
  return new Promise((resolve, reject) => {
    const maker = spawn(
      electron,
      [CLIP_MAKER_MAIN, file, join(userData, CLIP_MAKER_DATA)],
      {stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true},
    );
    let output = '';
    maker.stdout.setEncoding('utf8');
    maker.stdout.on('data', (text: string) => {
      output += text;
    });
    maker.once('error', reject);
    maker.once('close', code => {
      const summary = parseClipSummary(output.trim().split('\n').at(-1) ?? '');
      if (code === 0 && summary.ok) {
        resolve(summary.value);
        return;
      }
      const reason = summary.ok
        ? `exit code ${code ?? 'none'}`
        : summary.reason;
      reject(new Error(`the soak clip could not be made: ${reason}`));
    });
  });
}
