import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {offscreenApp} from './electron-app';

const FIRST = '33000000-0000-4000-8000-000000000001';
const SECOND = '33000000-0000-4000-8000-000000000002';
const WAIT = 30_000;

async function seedSong(
  data: string,
  song: {id: string; title: string; text: string},
): Promise<void> {
  const directory = join(data, 'LoveLight', 'Songs');
  await mkdir(directory, {recursive: true});
  await writeFile(
    join(directory, `${song.id}.llsong`),
    JSON.stringify({
      format: 'llsong',
      schemaVersion: 1,
      id: song.id,
      title: song.title,
      slides: [{label: '1절', lines: [song.text]}],
      arrangements: [],
    }),
    'utf8',
  );
}

it(
  'searches the library and preserves an edited song after restart',
  {timeout: 240_000},
  async () => {
    const app = await offscreenApp();
    await seedSong(app.data, {
      id: FIRST,
      title: '점검 알파',
      text: '첫 번째 창작 문장',
    });
    await seedSong(app.data, {
      id: SECOND,
      title: '점검 베타',
      text: '두 번째 창작 문장',
    });

    let page = await app.start();
    await page.getByRole('tab', {name: '준비'}).click();
    const search = page.getByRole('textbox', {name: '라이브러리 검색'});
    const library = page.getByRole('listbox', {name: '라이브러리'});
    await expect
      .poll(() => library.getByRole('option').count(), {timeout: WAIT})
      .toBe(2);

    await search.fill('알파');
    await expect
      .poll(() => library.getByRole('option').count(), {timeout: WAIT})
      .toBe(1);
    expect(await library.getByRole('option').first().innerText()).toContain(
      '점검 알파',
    );
    await search.fill('일치하지않는검색');
    await expect
      .poll(() => library.getByRole('option').count(), {timeout: WAIT})
      .toBe(0);
    await search.fill('알파');
    await expect
      .poll(() => library.getByRole('option').count(), {timeout: WAIT})
      .toBe(1);
    await library.getByRole('option').first().dblclick();

    const title = page.getByRole('textbox', {name: '곡 제목'});
    const lyrics = page.getByRole('textbox', {name: '슬라이드 1 가사'});
    await title.fill('점검 알파 수정');
    await title.press('Enter');
    await lyrics.fill('새로 만든 점검 문장');
    await lyrics.press('Tab');
    const file = join(app.data, 'LoveLight', 'Songs', `${FIRST}.llsong`);
    await expect
      .poll(
        async () => {
          const value: unknown = JSON.parse(await readFile(file, 'utf8'));
          return value;
        },
        {timeout: WAIT},
      )
      .toMatchObject({title: '점검 알파 수정', schemaVersion: 2});
    await expect
      .poll(
        async () =>
          (await readFile(file, 'utf8')).includes('새로 만든 점검 문장'),
        {
          timeout: WAIT,
        },
      )
      .toBe(true);

    await app.stop();
    page = await app.start();
    await page.getByRole('tab', {name: '준비'}).click();
    await page.getByRole('textbox', {name: '라이브러리 검색'}).fill('알파');
    const reopened = page
      .getByRole('listbox', {name: '라이브러리'})
      .getByRole('option');
    await expect.poll(() => reopened.count(), {timeout: WAIT}).toBe(1);
    await reopened.first().dblclick();
    expect(
      await page.getByRole('textbox', {name: '곡 제목'}).inputValue(),
    ).toBe('점검 알파 수정');
    expect(
      await page.getByRole('textbox', {name: '슬라이드 1 가사'}).inputValue(),
    ).toBe('새로 만든 점검 문장');
  },
);
