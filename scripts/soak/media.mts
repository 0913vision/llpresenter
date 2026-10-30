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
export const SOAK_AUDIO_ID = '5a0c4b3e-7d21-4f6a-9b8c-2e1f0d3c4b5b';
export const SOAK_AUDIO_PLAYLIST_ID = '5a0c4b3e-7d21-4f6a-9b8c-2e1f0d3c4b5c';

const CLIP_FILE_NAME = 'soak-loop.webm';
const AUDIO_FILE_NAME = 'soak-silence.wav';
const AUDIO_RATE = 8000;
const AUDIO_SECONDS = 2;

/** A small silent PCM wave: exercising playback can never make a sound. */
export function silentSoakAudio(): Buffer {
  const dataBytes = AUDIO_RATE * AUDIO_SECONDS * 2;
  const wave = Buffer.alloc(44 + dataBytes);
  wave.write('RIFF', 0);
  wave.writeUInt32LE(36 + dataBytes, 4);
  wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(AUDIO_RATE, 24);
  wave.writeUInt32LE(AUDIO_RATE * 2, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write('data', 36);
  wave.writeUInt32LE(dataBytes, 40);
  return wave;
}
const CLIP_NAME = '소크 시험 배경';
const DATA_FOLDER = 'LoveLight';
const MEDIA_FOLDER = 'Media';
const SETTINGS_FOLDER = 'Settings';
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
      {
        id: SOAK_AUDIO_ID,
        name: '소크 시험 무음',
        kind: 'audio',
        file: AUDIO_FILE_NAME,
        size: 44 + AUDIO_RATE * AUDIO_SECONDS * 2,
        duration: AUDIO_SECONDS,
      },
    ],
    playlists: [],
    audioPlaylists: [
      {
        id: SOAK_AUDIO_PLAYLIST_ID,
        name: '소크 시험 오디오',
        items: [SOAK_AUDIO_ID],
        loop: true,
      },
    ],
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
  await writeFile(join(mediaFolder, AUDIO_FILE_NAME), silentSoakAudio());
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

function keepTail(stream: Readable, maxChars: number): () => string {
  let text = '';
  stream.setEncoding('utf8');
  stream.on('data', (piece: string) => {
    text = (text + piece).slice(-maxChars);
  });
  return () => text;
}

async function stopMaker(
  maker: ChildProcessByStdio<null, Readable, null>,
): Promise<void> {
  maker.stdout.destroy();
  maker.unref();
  const {pid} = maker;
  if (pid === undefined) return;
  try {
    const result = await killProcessTree(pid);
    if (!result.ok) {
      console.error(`could not stop the clip maker: ${result.reason}`);
    }
  } catch (error) {
    console.error('could not stop the clip maker:', error);
  }
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
    const output = keepTail(maker.stdout, MAX_MAKER_OUTPUT_CHARS);
    let stopping = false;
    // NOTE(0913vision): The deadline rejects only after the maker's processes
    // are stopped (taskkill gives up after KILL_TIMEOUT_MS), so a caller that
    // sees the rejection never races the processes it stops. The close that
    // the stop causes doesn't count as the maker's own end.
    const deadline = setTimeout(() => {
      stopping = true;
      const seconds = command.deadlineMs / MS_PER_SECOND;
      const late = new Error(
        `the clip maker did not finish within ${seconds} s`,
      );
      stopMaker(maker).then(
        () => reject(late),
        () => reject(late),
      );
    }, command.deadlineMs);
    maker.once('error', error => {
      clearTimeout(deadline);
      reject(error);
    });
    maker.once('close', exitCode => {
      clearTimeout(deadline);
      if (stopping) return;
      try {
        resolve(summaryFrom(output(), exitCode));
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
