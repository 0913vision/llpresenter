import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it, onTestFinished, vi} from 'vitest';
import {parseGroupedSong} from '../../src/shared/schema/groupedSong';
import {makeTempDir} from '../temp-dir';
import {offscreenApp} from './electron-app';

const WAIT = 30_000;
const IMPORT_FILE_VARIABLE = 'LLP_TEST_IMPORT_FILE';
const TITLE = '가져온 창작 곡';
const LINE = '창작 가져오기 문장';

it(
  'imports a text file through the menu and saves a song file',
  {timeout: 240_000},
  async () => {
    const source = join(await makeTempDir(), 'import-source.txt');
    await writeFile(
      source,
      `[1절]
${LINE}`,
      'utf8',
    );
    vi.stubEnv(IMPORT_FILE_VARIABLE, source);
    onTestFinished(() => {
      vi.unstubAllEnvs();
    });
    const app = await offscreenApp();

    const page = await app.start();
    await page.getByRole('menuitem', {name: '파일'}).click();
    await page.getByRole('menuitem', {name: '가져오기', exact: true}).click();
    await page.getByRole('menuitem', {name: '텍스트 파일'}).click();

    const dialog = page.getByRole('dialog', {name: '텍스트 가져오기'});
    await dialog.getByRole('button', {name: '편집'}).click();
    const title = page.getByRole('textbox', {name: '곡 제목'});
    await title.fill(TITLE);
    await title.press('Enter');
    await page.getByRole('button', {name: '저장'}).click();

    const directory = join(app.data, 'LoveLight', '곡');
    const saved = async (): Promise<string | undefined> => {
      const files = await readdir(directory).catch(() => []);
      const name = files.find(file => file.endsWith('.llsong'));
      return name === undefined
        ? undefined
        : readFile(join(directory, name), 'utf8');
    };
    await expect.poll(saved, {timeout: WAIT}).toContain(LINE);
    const text = await saved();
    if (text === undefined) throw new Error('Song file was not saved');
    const parsed = parseGroupedSong(text, 'song');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.data.title).toBe(TITLE);
  },
);
