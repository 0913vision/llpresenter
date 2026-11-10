import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {MAIN_SCREEN} from '@fixtures/core/screenIds';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {offscreenApp} from './electron-app';

const SERVICE = '55000000-0000-4000-8000-000000000001';
const SONG = '55000000-0000-4000-8000-000000000002';
const ITEM = '55000000-0000-4000-8000-000000000003';
const WAIT = 30_000;

it(
  'recovers a service and its live output after a forced exit',
  {timeout: 240_000},
  async () => {
    const app = await offscreenApp();
    const root = join(app.data, 'LoveLight');
    await mkdir(join(root, 'Songs'), {recursive: true});
    await mkdir(join(root, 'Services'), {recursive: true});
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
        title: '창작 복구 곡',
        slides: [
          {id: fixtureSlideId(1), lines: ['새로 만든 점검 문장'], label: '1절'},
        ],
      }),
      'utf8',
    );
    await writeFile(
      join(root, 'Services', `${SERVICE}.llservice`),
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id: SERVICE,
        name: '복구 점검 예배',
        date: '2026-01-01T10:00',
        order: [
          {
            slides: [
              {
                id: fixtureSlideId(1),
                lines: ['새로 만든 점검 문장'],
                label: '1절',
              },
            ],
            id: ITEM,
            song: SONG,
          },
        ],
      }),
      'utf8',
    );

    let page = await app.start();
    const order = page.getByRole('listbox', {name: '예배 순서'});
    await order.getByRole('option', {name: '창작 복구 곡'}).click();
    await page
      .getByRole('listbox', {name: '슬라이드'})
      .getByRole('option')
      .first()
      .click();
    await expect
      .poll(
        () =>
          page.evaluate<boolean>(
            'window.llp.live.get().then(live => live.layers.slide !== null)',
          ),
        {timeout: WAIT},
      )
      .toBe(true);
    await page.evaluate(
      `window.llp.live.send({type: 'output.set', screenId: '${MAIN_SCREEN}', on: true})`,
    );
    await expect
      .poll(
        () =>
          page.evaluate<boolean>(
            `window.llp.live.get().then(live => live.outputs['${MAIN_SCREEN}'] === true)`,
          ),
        {timeout: WAIT},
      )
      .toBe(true);
    const record = join(app.data, 'recovery', 'live.json');
    const itemId = await page.evaluate<string>(
      'window.llp.live.get().then(live => live.layers.slide.itemId)',
    );
    await expect
      .poll(
        async () => {
          try {
            return (await readFile(record, 'utf8')).includes(itemId);
          } catch {
            return false;
          }
        },
        {timeout: WAIT},
      )
      .toBe(true);
    await app.crash();
    page = await app.start();
    const recovery = page.getByRole('alertdialog', {
      name: '출력 내용을 복구할까요?',
    });
    await recovery.getByRole('button', {name: '복구'}).click();
    await expect
      .poll(
        () =>
          page.evaluate<string | null>(
            'window.llp.service.get().then(service => service?.id ?? null)',
          ),
        {timeout: WAIT},
      )
      .toBe(SERVICE);
    await expect
      .poll(
        () =>
          page.evaluate<string | null>(
            'window.llp.live.get().then(live => live.layers.slide?.itemId ?? null)',
          ),
        {timeout: WAIT},
      )
      .toBe(itemId);
    await expect
      .poll(
        () =>
          page
            .getByRole('listbox', {name: '예배 순서'})
            .getByRole('option', {name: '창작 복구 곡'})
            .count(),
        {timeout: WAIT},
      )
      .toBe(1);
  },
);
