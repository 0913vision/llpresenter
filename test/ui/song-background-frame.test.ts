import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {MAIN_SCREEN} from '@fixtures/core/screenIds';
import {parseSong} from '@core/schema/song';
import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {offscreenApp} from './electron-app';

const SERVICE = '55000000-0000-4000-8000-000000000001';
const SONG = '55000000-0000-4000-8000-000000000002';
const ITEM = '55000000-0000-4000-8000-000000000003';
const MEDIA = '55000000-0000-4000-8000-000000000005';
const WAIT = 30000;

it(
  'keeps song background placement in the editor and output',
  {timeout: 300000},
  async () => {
    const app = await offscreenApp();
    const root = join(app.data, 'LoveLight');
    await mkdir(join(root, 'Songs'), {recursive: true});
    await mkdir(join(root, 'Services'), {recursive: true});
    await mkdir(join(root, 'Media'), {recursive: true});
    await mkdir(join(root, 'Settings'), {recursive: true});
    await copyFile(
      'src/main/store/assets/notice-122.png',
      join(root, 'Media', 'background.png'),
    );
    await writeFile(
      join(root, 'Settings', 'media.json'),
      JSON.stringify({
        format: 'llmedia',
        schemaVersion: 1,
        playlists: [],
        audioPlaylists: [],
        items: [
          {
            id: MEDIA,
            name: '배경 점검',
            kind: 'image',
            file: 'background.png',
            size: 0,
          },
        ],
      }),
    );
    await writeFile(
      join(app.data, 'app.json'),
      JSON.stringify({
        format: 'llapp',
        schemaVersion: 1,
        lastServiceId: SERVICE,
      }),
    );
    const slide = {
      id: fixtureSlideId(1),
      lines: ['화면 배경 점검'],
      label: '1절',
    };
    const songFile = join(root, 'Songs', `${SONG}.llsong`);
    await writeFile(
      songFile,
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 1,
        id: SONG,
        title: '배경 위치 점검',
        background: MEDIA,
        slides: [slide],
      }),
    );
    await writeFile(
      join(root, 'Services', `${SERVICE}.llservice`),
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id: SERVICE,
        name: '점검 예배',
        date: '2026-01-01T10:00',
        order: [
          {
            id: '55000000-0000-4000-8000-000000000004',
            slides: {
              form: 'blank',
              name: '앞 순서',
              slides: [{id: fixtureSlideId(2), text: '앞 순서'}],
            },
          },
          {id: ITEM, song: SONG, slides: [slide]},
        ],
      }),
    );
    const page = await app.start();
    await page.setViewportSize({width: 1600, height: 900});
    await page.getByRole('tab', {name: '준비'}).click();
    await page.getByRole('tab', {name: '곡', exact: true}).click();
    const library = page.getByRole('listbox', {name: '라이브러리 곡'});
    await expect
      .poll(() => library.getByRole('option').count(), {timeout: WAIT})
      .toBe(1);
    await library.getByRole('option').first().dblclick();
    await page.getByRole('textbox', {name: '곡 제목'}).waitFor({timeout: WAIT});
    await page.getByRole('button', {name: '위치와 크기'}).click();
    await page.getByRole('spinbutton', {name: '배경 W'}).fill('1200');
    await page.getByRole('spinbutton', {name: '배경 W'}).press('Enter');
    await page.getByRole('spinbutton', {name: '배경 X'}).fill('200');
    await page.getByRole('spinbutton', {name: '배경 X'}).press('Enter');
    if (process.env['LLP_U38_CAPTURE'] !== undefined) {
      await mkdir(process.env['LLP_U38_CAPTURE'], {recursive: true});
      await page.screenshot({
        path: join(process.env['LLP_U38_CAPTURE'], 'editor.png'),
      });
    }
    await page
      .getByRole('dialog', {name: '배경 위치와 크기'})
      .getByRole('button', {name: '닫기'})
      .click();
    await page.getByRole('button', {name: '저장', exact: true}).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', {name: '덮어쓰기'})
      .click();
    await expect
      .poll(
        async () => {
          const parsed = parseSong(await readFile(songFile, 'utf8'), songFile);
          return parsed.ok ? parsed.value.data.backgroundFrame : undefined;
        },
        {timeout: WAIT},
      )
      .toEqual({x: 200, y: 0, w: 1200, h: 1080});
    expect(await app.stop()).toBe(false);
    const reopened = await app.start();
    await reopened.getByRole('tab', {name: '준비'}).click();
    await reopened.getByRole('tab', {name: '곡', exact: true}).click();
    const again = reopened
      .getByRole('listbox', {name: '라이브러리 곡'})
      .getByRole('option');
    await expect.poll(() => again.count(), {timeout: WAIT}).toBe(1);
    await again.first().dblclick();
    await reopened.getByRole('button', {name: '위치와 크기'}).click();
    expect(
      await reopened.getByRole('spinbutton', {name: '배경 X'}).inputValue(),
    ).toBe('200');
    expect(
      await reopened.getByRole('spinbutton', {name: '배경 W'}).inputValue(),
    ).toBe('1200');
    if (process.env['LLP_U38_CAPTURE'] !== undefined) {
      await reopened.screenshot({
        path: join(process.env['LLP_U38_CAPTURE'], 'reopened.png'),
      });
    }
    await reopened
      .getByRole('dialog', {name: '배경 위치와 크기'})
      .getByRole('button', {name: '닫기'})
      .click();
    await reopened.getByRole('tab', {name: '진행'}).click();
    await reopened
      .getByRole('listbox', {name: '예배 순서'})
      .getByRole('option', {name: '앞 순서'})
      .click();
    await reopened
      .getByRole('listbox', {name: '슬라이드'})
      .getByRole('option')
      .first()
      .click();
    await reopened
      .getByRole('listbox', {name: '예배 순서'})
      .getByRole('option', {name: '배경 위치 점검'})
      .click();
    await reopened
      .getByRole('listbox', {name: '슬라이드'})
      .getByRole('option', {name: /화면 배경 점검/})
      .click();
    await expect
      .poll(
        () =>
          reopened.evaluate(
            'window.llp.live.get().then(s => s.layers.media?.backgroundFrame)',
          ),
        {timeout: WAIT},
      )
      .toEqual({x: 200, y: 0, w: 1200, h: 1080});
    await reopened.evaluate(
      `window.llp.live.send({type:'output.set',screenId:'${MAIN_SCREEN}',on:true})`,
    );
    await expect
      .poll(
        () =>
          app
            .electron()
            .windows()
            .some(window => window.url().includes(`screen=${MAIN_SCREEN}`)),
        {timeout: WAIT},
      )
      .toBe(true);
    const output = app
      .electron()
      .windows()
      .find(window => window.url().includes(`screen=${MAIN_SCREEN}`));
    if (output === undefined) throw new Error('Output window missing');
    await expect
      .poll(
        () =>
          output.locator('img[style*="62.5%"], video[style*="62.5%"]').count(),
        {timeout: WAIT},
      )
      .toBeGreaterThan(0);
    if (process.env['LLP_U38_CAPTURE'] !== undefined) {
      await output.screenshot({
        path: join(process.env['LLP_U38_CAPTURE'], 'output.png'),
      });
    }
  },
);
