import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {app, BrowserWindow} from 'electron';
import {
  checkFrameTiming,
  checkPlayback,
  parseClipArgs,
  parseEncodedFrames,
  parsePageOutcome,
  parsePlayback,
  SOAK_CLIP,
  type Checked,
  type ClipSummary,
} from '../clip-frames.mts';
import {muxWebm} from '../webm.mts';

const PAGE = join(import.meta.dirname, 'page.html');
const SCRIPT = join(import.meta.dirname, 'encode.js');
const MS_PER_SECOND = 1000;
const FAILURE_EXIT_CODE = 1;

function unwrap<T>(checked: Checked<T>): T {
  if (!checked.ok) throw new Error(checked.reason);
  return checked.value;
}

async function openPage(window: BrowserWindow): Promise<void> {
  await window.loadFile(PAGE);
  const script = await readFile(SCRIPT, 'utf8');
  // NOTE(0913vision): A script's value goes back to the main process, and the
  // functions it defines can't be cloned, so it ends with null.
  await window.webContents.executeJavaScript(`${script}\nnull;`);
}

// NOTE(0913vision): executeJavaScript drops a rejection's message, so the page
// hands back the error text itself.
async function callPage(window: BrowserWindow, call: string): Promise<unknown> {
  const outcome: unknown = await window.webContents.executeJavaScript(
    `${call}.then(value => ({value}), error => ({error: String(error?.stack ?? error)}))`,
  );
  return unwrap(parsePageOutcome(outcome));
}

async function makeClip(
  window: BrowserWindow,
  file: string,
): Promise<ClipSummary> {
  await openPage(window);
  const sent = await callPage(
    window,
    `encodeClip(${JSON.stringify(SOAK_CLIP)})`,
  );
  const frames = unwrap(parseEncodedFrames(sent));
  unwrap(checkFrameTiming(frames, SOAK_CLIP));
  const frameMs = MS_PER_SECOND / SOAK_CLIP.fps;
  const {width, height} = SOAK_CLIP;
  const bytes = muxWebm({width, height, frameMs, frames});
  await writeFile(file, bytes);
  const url = JSON.stringify(pathToFileURL(file).href);
  const playback = unwrap(
    parsePlayback(await callPage(window, `checkClip(${url})`)),
  );
  unwrap(checkPlayback(playback, SOAK_CLIP));
  return {
    file,
    bytes: bytes.length,
    frames: frames.length,
    durationMs: Math.round(playback.duration * MS_PER_SECOND),
  };
}

async function main(file: string): Promise<void> {
  await app.whenReady();
  // NOTE(0913vision): The window is never shown and draws offscreen, so
  // nothing appears on the user's screen.
  const window = new BrowserWindow({
    show: false,
    width: 320,
    height: 180,
    webPreferences: {offscreen: true, backgroundThrottling: false},
  });
  try {
    console.log(JSON.stringify(await makeClip(window, file)));
  } finally {
    window.destroy();
  }
}

// NOTE(0913vision): The arguments are read before anything is written or any
// window is created, so a wrong call ends with nothing changed.
const args = parseClipArgs(process.argv.slice(2));
if (!args.ok) {
  console.error(
    `Usage: electron main.mts <clip.webm> <user data folder> (${args.reason})`,
  );
  app.exit(FAILURE_EXIT_CODE);
} else {
  const {file, userData} = args.value;
  // NOTE(0913vision): Electron keeps its caches in the user data folder, so it
  // goes to the soak run's temporary folder, not to the user's AppData.
  app.setPath('userData', userData);
  app.disableHardwareAcceleration();
  main(file).then(
    () => app.exit(0),
    (error: unknown) => {
      console.error('the soak clip could not be made:', error);
      app.exit(FAILURE_EXIT_CODE);
    },
  );
}
