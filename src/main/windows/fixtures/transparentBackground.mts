import {ok} from 'node:assert/strict';
import {isAbsolute} from 'node:path';
import {app, BrowserWindow, type WebContentsPaintEventParams} from 'electron';
import {watchPixelFixture} from './pixelFixtureLifecycle.mts';
import {
  PIXEL_CHANNEL_TOLERANCE,
  waitForCompositedPixels,
  type ExpectedPixels,
  type PixelSample,
} from './compositedPixels.mts';

const CHECK_INTERVAL_MS = 10;
const PICTURE_VALUE = 200;
let exiting = false;

function fail(error: unknown): void {
  if (exiting) return;
  exiting = true;
  deadline.dispose();
  console.error('transparent background regression failed:', error);
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.removeListener('paint', releaseFrame);
      win.destroy();
    }
  } finally {
    app.exit(1);
  }
}

process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
app.on('window-all-closed', () => undefined);
const deadline = watchPixelFixture(phase =>
  fail(new Error(`fixture ${phase} timed out`)),
);
const [page, userData] = process.argv.slice(2);
if (
  process.env['LLP_TEST_WINDOWS'] !== 'offscreen' ||
  page === undefined ||
  userData === undefined ||
  !isAbsolute(page) ||
  !isAbsolute(userData)
) {
  fail(new Error('Expected offscreen mode, a page, and isolated user data'));
} else {
  app.setPath('userData', userData);
  run(page).then(() => {
    deadline.dispose();
    app.exit(0);
  }, fail);
}

async function waitForPictures(win: BrowserWindow): Promise<void> {
  for (;;) {
    const state: unknown = await win.webContents.executeJavaScript(
      'document.body.dataset.ready',
    );
    if (state === 'true') return;
    if (state === 'failed') throw new Error('Could not decode fixture PNGs');
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
  }
}

async function pixels(win: BrowserWindow): Promise<PixelSample> {
  await win.webContents.executeJavaScript(
    'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
  );
  const image = await win.webContents.capturePage();
  const {width, height} = image.getSize();
  if (width === 0 || height === 0) {
    return {transparent: [], translucent: [], opaque: []};
  }
  const at = (x: number): number[] => [
    ...image
      .crop({x, y: Math.floor(height / 2), width: 1, height: 1})
      .toBitmap()
      .subarray(0, 3),
  ];
  return {
    transparent: at(Math.floor(width / 6)),
    translucent: at(Math.floor(width / 2)),
    opaque: at(Math.floor((width * 5) / 6)),
  };
}

function expectPixel(
  pixel: readonly number[],
  expected: number,
  phase: string,
): void {
  ok(
    pixel.length === 3 &&
      pixel.every(
        value => Math.abs(value - expected) <= PIXEL_CHANNEL_TOLERANCE,
      ),
    `${phase}: expected ${expected}, received ${pixel.join(', ')}`,
  );
}

function compositedPixels(
  win: BrowserWindow,
  expected: ExpectedPixels,
  phase: string,
): Promise<PixelSample> {
  return waitForCompositedPixels({capture: () => pixels(win), expected, phase});
}

function releaseFrame({texture}: WebContentsPaintEventParams): void {
  texture?.release();
}

async function checkMode(
  page: string,
  mode: 'output' | 'preview',
): Promise<void> {
  const width = mode === 'output' ? 256 : 128;
  const win = new BrowserWindow({
    show: false,
    focusable: false,
    skipTaskbar: true,
    width,
    height: (width * 9) / 16,
    webPreferences: {
      offscreen: {useSharedTexture: true},
      backgroundThrottling: false,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on('paint', releaseFrame);
  try {
    await win.loadFile(page, {query: {mode}});
    await waitForPictures(win);
    deadline.checking();
    const samples = [];
    const background = mode === 'preview' ? 32 : 0;
    for (const opacity of [0, 0.5, 1]) {
      await win.webContents.executeJavaScript(
        `document.getElementById('incoming').style.opacity = '${opacity}'`,
      );
      const sample = await compositedPixels(
        win,
        {
          transparent: PICTURE_VALUE * (1 - opacity) + background * opacity,
          translucent:
            PICTURE_VALUE * (1 - opacity) +
            ((PICTURE_VALUE + background) / 2) * opacity,
          opaque: PICTURE_VALUE,
        },
        `${mode} opacity ${opacity}`,
      );
      samples.push({opacity, ...sample});
    }
    await win.webContents.executeJavaScript(
      "document.getElementById('outgoing').remove()",
    );
    const after = await compositedPixels(
      win,
      {
        transparent: background,
        translucent: (PICTURE_VALUE + background) / 2,
        opaque: PICTURE_VALUE,
      },
      `${mode} after outgoing removal`,
    );
    console.log(JSON.stringify({mode, samples, after}));
    for (const sample of samples) {
      const expected =
        PICTURE_VALUE * (1 - sample.opacity) + background * sample.opacity;
      expectPixel(
        sample.transparent,
        expected,
        `${mode} opacity ${sample.opacity}`,
      );
      const translucent =
        PICTURE_VALUE * (1 - sample.opacity) +
        ((PICTURE_VALUE + background) / 2) * sample.opacity;
      expectPixel(sample.translucent, translucent, `${mode} translucent area`);
      expectPixel(sample.opaque, PICTURE_VALUE, `${mode} opaque area`);
    }
    expectPixel(
      after.transparent,
      background,
      `${mode} after outgoing removal`,
    );
    expectPixel(
      after.translucent,
      (PICTURE_VALUE + background) / 2,
      `${mode} translucent area after removal`,
    );
    expectPixel(
      after.opaque,
      PICTURE_VALUE,
      `${mode} opaque area after removal`,
    );
  } finally {
    if (!win.isDestroyed()) {
      win.webContents.removeListener('paint', releaseFrame);
      win.destroy();
    }
  }
}

async function run(page: string): Promise<void> {
  await app.whenReady();
  await checkMode(page, 'output');
  deadline.starting();
  await checkMode(page, 'preview');
  console.log('transparent background regression passed');
}
