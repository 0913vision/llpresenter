import {writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {beforeEach, expect, it, vi} from 'vitest';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {themeScreens} from '@fixtures/core/themeOutput';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {makeTempDir} from '@fixtures/tempDir';
import {diagnosticsText} from '@main/application/diagnostics';

const electron = vi.hoisted(() => ({
  gpu: vi.fn<() => Promise<unknown>>(),
}));
vi.mock('electron', () => ({
  app: {getGPUInfo: electron.gpu, getVersion: () => '0.227.0'},
  screen: {
    getAllDisplays: () => [
      {size: {width: 1920, height: 1080}, scaleFactor: 1.25},
      {size: {width: 3840, height: 2160}, scaleFactor: 2},
    ],
  },
}));

beforeEach(() => {
  // NOTE(0913vision): Electron adds this to the process; Node has none.
  process.getSystemVersion = () => '10.0.19045';
  electron.gpu.mockResolvedValue({
    auxAttributes: {glRenderer: 'ANGLE (Invented Graphics 770)'},
  });
});

async function setup({
  log = '',
  screens = async () => settingsDocument('screens', {screens: themeScreens}),
}: {
  readonly log?: string;
  readonly screens?: () => Promise<ReturnType<typeof settingsDocument>>;
} = {}) {
  const logDirectory = await makeTempDir();
  if (log !== '') await writeFile(join(logDirectory, 'main.log'), log);
  const dataFolder = join(homedir(), 'AppData', 'Roaming', 'LoveLight');
  const logger = recordingLogger();
  const collect = diagnosticsText({
    logDirectory,
    dataFolder,
    screens,
    launch: () => ['settings 120 ms'],
    log: logger,
  });
  return {collect, dataFolder, logger};
}

it('copies the versions, graphics, monitors, screens and launch', async () => {
  const {collect} = await setup();
  const text = await collect();
  expect(text).toContain('LoveLight 0.227.0\nWindows 10.0.19045\n');
  expect(text).toContain('Graphics: ANGLE (Invented Graphics 770)\n');
  expect(text).toContain('  1: 1920x1080 at 125%\n  2: 3840x2160 at 200%\n');
  expect(text).toContain(`  ${themeScreens[0]?.name} (`);
  expect(text).toContain('Launch:\n  settings 120 ms\n');
  expect(text).toContain('Last errors (0):');
});

it('copies the last error lines of the log, with the app data and home folders masked', async () => {
  const home = homedir();
  const data = join(home, 'AppData', 'Roaming', 'LoveLight');
  const {collect} = await setup({
    log: [
      `2026-11-26 06:00:00.000 INFO opened ${data}`,
      `2026-11-26 06:00:01.000 ERROR could not save ${join(data, 'songs', 'a.llsong')}`,
      `2026-11-26 06:00:02.000 ERROR could not read ${join(home, 'Desktop', 'b.pptx')}`,
    ].join('\n'),
  });
  const text = await collect();
  expect(text).toContain('Last errors (2):');
  expect(text).toContain(
    `ERROR could not save ${join('<app data>', 'songs', 'a.llsong')}`,
  );
  expect(text).toContain(
    `ERROR could not read ${join('~', 'Desktop', 'b.pptx')}`,
  );
  expect(text).not.toContain(home);
});

it('reads only the end of a long log', async () => {
  const {collect} = await setup({
    log: [
      '2026-11-26 05:00:00.000 ERROR an old failure',
      'x'.repeat(200 * 1024),
      '2026-11-26 06:00:00.000 ERROR a new failure',
    ].join('\n'),
  });
  const text = await collect();
  expect(text).toContain('ERROR a new failure');
  expect(text).not.toContain('an old failure');
});

it('names the graphics adapter by its vendor and device when it has no renderer name', async () => {
  electron.gpu.mockResolvedValue({
    gpuDevice: [{vendorId: 0x8086, deviceId: 0x4680}, {vendorId: 'odd'}],
  });
  const {collect} = await setup();
  expect(await collect()).toContain('Graphics: vendor 8086 device 4680\n');
});

it('leaves out what it can not read, and says why the graphics adapter is unknown', async () => {
  electron.gpu.mockRejectedValue(new Error('no GPU process'));
  const {collect, logger} = await setup({
    screens: () => Promise.reject(new Error('settings gone')),
  });
  const text = await collect();
  expect(text).toContain('Graphics: unknown\n');
  expect(text).toContain('Screens:\nLaunch:');
  expect(text).toContain('Last errors (0):');
  expect(logger.entries).toContainEqual(
    expect.objectContaining({
      level: 'warn',
      message: 'could not read the graphics adapter',
    }),
  );
});
