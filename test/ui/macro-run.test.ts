import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {offscreenApp} from './electron-app';
import {openToolTab} from './tool-tab';

const SERVICE = '44000000-0000-4000-8000-000000000001';
const SONG = '44000000-0000-4000-8000-000000000002';
const ITEM = '44000000-0000-4000-8000-000000000003';
const MACRO = '44000000-0000-4000-8000-000000000004';
const WAIT = 30_000;

it(
  'runs a macro tile and restores the cleared slide',
  {timeout: 240_000},
  async () => {
    const app = await offscreenApp();
    const root = join(app.data, 'LoveLight');
    for (const folder of ['Songs', 'Services', 'Settings']) {
      await mkdir(join(root, folder), {recursive: true});
    }
    await writeFile(
      join(app.data, 'app.json'),
      JSON.stringify({
        format: 'llapp',
        schemaVersion: 1,
        lastServiceId: SERVICE,
      }),
      'utf8',
    );
    await writeFile(
      join(root, 'Songs', `${SONG}.llsong`),
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 1,
        id: SONG,
        title: '창작 점검 곡',
        slides: [{label: '1절', lines: ['매크로 점검 문장']}],
      }),
      'utf8',
    );
    await writeFile(
      join(root, 'Services', `${SERVICE}.llservice`),
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id: SERVICE,
        name: '점검 순서',
        date: '2026-01-01T10:00',
        order: [{id: ITEM, song: SONG}],
      }),
      'utf8',
    );
    await writeFile(
      join(root, 'Settings', 'macros.json'),
      JSON.stringify({
        format: 'llsettings.macros',
        schemaVersion: 1,
        macros: [
          {
            id: MACRO,
            name: '점검 지우기',
            icon: 'clear',
            color: 'slate',
            actions: [{kind: 'clearLayer', layer: 'slide'}],
          },
        ],
        collections: [],
      }),
      'utf8',
    );
    await writeFile(
      join(root, 'Settings', 'preferences.json'),
      JSON.stringify({
        format: 'llsettings.preferences',
        schemaVersion: 1,
        show: {showClearUndoButton: true},
      }),
      'utf8',
    );

    const page = await app.start();
    const order = page.getByRole('listbox', {name: '예배 순서'});
    await order.getByRole('option', {name: '창작 점검 곡'}).click();
    await page
      .getByRole('listbox', {name: '슬라이드'})
      .getByRole('option')
      .first()
      .click();
    const showing = (): Promise<boolean> =>
      page.evaluate<boolean>(`window.llp.live.get().then(live =>
        live.layers.slide?.itemId === '${ITEM}')`);
    await expect.poll(showing, {timeout: WAIT}).toBe(true);
    await openToolTab(page, '매크로');
    await page
      .getByRole('listbox', {name: '매크로'})
      .getByRole('option', {name: '점검 지우기'})
      .click();
    await expect.poll(showing, {timeout: WAIT}).toBe(false);
    await page.getByRole('button', {name: '되돌리기'}).click();
    await expect.poll(showing, {timeout: WAIT}).toBe(true);
  },
);
