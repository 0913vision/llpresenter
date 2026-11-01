import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {offscreenApp} from './electron-app';

const WAIT = 30_000;

it(
  'remaps a workspace command from a real settings file',
  {timeout: 240_000},
  async () => {
    const app = await offscreenApp();
    const settings = join(app.data, 'LoveLight', 'Settings');
    await mkdir(settings, {recursive: true});
    await writeFile(
      join(settings, 'shortcuts.json'),
      JSON.stringify({
        format: 'llsettings.shortcuts',
        schemaVersion: 1,
        bindings: {'workspace.prep': [{code: 'Digit9', mods: ['ctrl', 'alt']}]},
      }),
      'utf8',
    );
    const page = await app.start();
    await expect
      .poll(
        () =>
          page
            .getByRole('tab', {name: '진행', exact: true})
            .getAttribute('aria-selected'),
        {timeout: WAIT},
      )
      .toBe('true');
    await page.keyboard.press('Control+Alt+Digit9');
    await expect
      .poll(
        () =>
          page
            .getByRole('tab', {name: '준비', exact: true})
            .getAttribute('aria-selected'),
        {timeout: WAIT},
      )
      .toBe('true');
  },
);
