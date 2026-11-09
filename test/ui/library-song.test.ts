import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Page} from 'playwright-core';
import {expect, it} from 'vitest';
import {parseSong} from '@core/schema/song';
import {offscreenApp} from './electron-app';

const FIRST = '33000000-0000-4000-8000-000000000001';
const WAIT = 30_000;

/**
 * What a failed save left behind, for the failure message: the editor's visible
 * text (the question or the notice the operator would read), the song file's
 * title, and the end of the app's log.
 */
async function saveEvidence(
  editor: Page,
  data: string,
  file: string,
): Promise<string> {
  const read = async (work: () => Promise<string>): Promise<string> => {
    try {
      return await work();
    } catch (error) {
      return `unreadable (${error instanceof Error ? error.message : String(error)})`;
    }
  };
  const visible = await read(async () =>
    (await editor.locator('body').innerText({timeout: 2_000})).slice(0, 800),
  );
  const title = await read(async () => {
    const parsed = parseSong(await readFile(file, 'utf8'), file);
    return parsed.ok ? parsed.value.data.title : parsed.error.message;
  });
  const log = await read(async () => {
    const folder = join(data, 'logs');
    const names = (await readdir(folder)).sort();
    const last = names.at(-1);
    if (last === undefined) return 'no log file';
    const lines = (await readFile(join(folder, last), 'utf8')).split('\n');
    return lines.slice(-30).join('\n');
  });
  return [
    'Song save evidence',
    `editor text: ${visible}`,
    `song file: ${title.slice(0, 300)}`,
    `log end:\n${log}`,
  ].join('\n');
}

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
      slides: [{id: fixtureSlideId(1), lines: [song.text], label: '1절'}],
    }),
    'utf8',
  );
}

it(
  'preserves an edited library song after restart',
  {timeout: 240_000},
  async () => {
    const app = await offscreenApp();
    await seedSong(app.data, {
      id: FIRST,
      title: '점검 알파',
      text: '첫 번째 창작 문장',
    });
    let page = await app.start();
    await page.getByRole('tab', {name: '준비'}).click();
    const library = page.getByRole('listbox', {name: '라이브러리 곡'});
    await expect
      .poll(() => library.getByRole('option').count(), {timeout: WAIT})
      .toBe(1);
    await library.getByRole('option').first().dblclick();

    const editor = page;
    const title = editor.getByRole('textbox', {name: '곡 제목'});
    await title.waitFor({timeout: WAIT});
    const lyrics = editor.getByRole('textbox', {name: '슬라이드 1 가사'});
    await lyrics.waitFor({timeout: WAIT});
    await title.fill('점검 알파 수정');
    await title.press('Enter');
    await page.waitForFunction(
      `document.activeElement?.getAttribute('aria-label') === '슬라이드 1 가사'`,
      {timeout: WAIT},
    );
    await expect.poll(() => lyrics.inputValue()).toBe('첫 번째 창작 문장');
    await lyrics.fill('새로 만든 점검 문장');
    await expect.poll(() => lyrics.inputValue()).toBe('새로 만든 점검 문장');
    await lyrics.press('Tab');
    const file = join(app.data, 'LoveLight', 'Songs', `${FIRST}.llsong`);
    await editor.getByRole('button', {name: '저장', exact: true}).click();
    const question = editor.getByRole('alertdialog');
    await question.getByRole('button', {name: '덮어쓰기'}).click();
    try {
      // NOTE(0913vision): The operator sees the question close when the save
      // is accepted; the file follows within the store's write delay. A
      // question that stays open means the save was refused.
      await question.waitFor({state: 'detached', timeout: WAIT});
      await expect
        .poll(
          async () => {
            const value: unknown = JSON.parse(await readFile(file, 'utf8'));
            return value;
          },
          {timeout: WAIT},
        )
        .toMatchObject({title: '점검 알파 수정', schemaVersion: 1});
      await expect
        .poll(
          async () =>
            (await readFile(file, 'utf8')).includes('새로 만든 점검 문장'),
          {timeout: WAIT},
        )
        .toBe(true);
    } catch (error) {
      throw new Error(await saveEvidence(editor, app.data, file), {
        cause: error,
      });
    }

    await app.stop();
    page = await app.start();
    await page.getByRole('tab', {name: '준비'}).click();
    const reopened = page
      .getByRole('listbox', {name: '라이브러리 곡'})
      .getByRole('option');
    await expect.poll(() => reopened.count(), {timeout: WAIT}).toBe(1);
    await reopened.first().dblclick();
    const reopenedEditor = page;
    await reopenedEditor
      .getByRole('textbox', {name: '곡 제목'})
      .waitFor({timeout: WAIT});
    expect(
      await reopenedEditor.getByRole('textbox', {name: '곡 제목'}).inputValue(),
    ).toBe('점검 알파 수정');
    expect(
      await reopenedEditor
        .getByRole('textbox', {name: '슬라이드 1 가사'})
        .inputValue(),
    ).toBe('새로 만든 점검 문장');
  },
);
