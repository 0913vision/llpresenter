import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {ElectronApplication, Page} from 'playwright-core';
import {expect, it} from 'vitest';
import {offscreenApp} from './electron-app';
import {openToolTab} from './tool-tab';

const WAIT = 30_000;

async function openScreenSettings(
  control: Page,
  app: ElectronApplication,
): Promise<Page> {
  await control.getByRole('menuitem', {name: '출력', exact: true}).click();
  await control.getByRole('menuitem', {name: '화면 설정…'}).click();
  const findSettings = () =>
    app.windows().find(page => page.url().includes('window=screens'));
  await expect
    .poll(() => findSettings() !== undefined, {timeout: WAIT})
    .toBe(true);
  const settings = findSettings();
  if (settings === undefined) {
    throw new Error('Screen settings window not found');
  }
  await settings
    .getByRole('main', {name: '화면 설정'})
    .waitFor({timeout: WAIT});
  expect(
    await app.evaluate(({BrowserWindow}) =>
      BrowserWindow.getAllWindows().every(window => !window.isVisible()),
    ),
  ).toBe(true);
  return settings;
}

async function checkZoomedSettings(
  settings: Page,
  app: ElectronApplication,
): Promise<void> {
  await app.evaluate(({BrowserWindow}) => {
    const win = BrowserWindow.getAllWindows().find(window =>
      window.webContents.getURL().includes('window=screens'),
    );
    if (win === undefined) throw new Error('Screen settings window not found');
    win.setBounds({width: 1280, height: 720});
    win.webContents.setZoomFactor(1.5);
  });
  const columns = 'document.querySelector(\'main[aria-label="화면 설정"]\')';
  await expect
    .poll(() =>
      settings.evaluate<string>(`getComputedStyle(${columns}).overflowX`),
    )
    .toBe('auto');
  await expect
    .poll(() =>
      settings.evaluate<boolean>(
        `${columns}.scrollWidth > ${columns}.clientWidth`,
      ),
    )
    .toBe(true);
  await settings.evaluate<number>(
    `${columns}.scrollLeft = ${columns}.scrollWidth`,
  );
  expect(
    await settings.evaluate<boolean>(`(() => {
    const element = ${columns};
    const properties = element.querySelector('[aria-label="속성"]');
    const column = properties?.getBoundingClientRect();
    const viewport = element.getBoundingClientRect();
    return column !== undefined && column.left >= viewport.left && column.right <= viewport.right;
  })()`),
  ).toBe(true);
}

it(
  'saves focused screen edits on close and quit, and runs output actions',
  {timeout: 240_000},
  async () => {
    const app = await offscreenApp();
    const settings = join(app.data, 'LoveLight', 'Settings');
    await mkdir(settings, {recursive: true});
    await writeFile(
      join(settings, 'messages.json'),
      JSON.stringify({
        format: 'llsettings.messages',
        schemaVersion: 1,
        templates: [
          {
            id: '33000000-0000-4000-8000-000000000003',
            name: '점검 메시지',
            icon: 'msg',
            text: '창작 안내 문장',
            targets: 'all',
            duration: 30,
          },
        ],
        stagePresets: [],
      }),
      'utf8',
    );

    const page = await app.start();
    const screenSettings = await openScreenSettings(page, app.electron());
    await checkZoomedSettings(screenSettings, app.electron());
    const name = screenSettings.getByRole('textbox', {name: '이름'});
    await name.fill('점검 화면');
    await name.press('Enter');
    const offset = screenSettings.getByRole('spinbutton', {name: '가로 위치'});
    await offset.fill('12');
    await Promise.all([
      screenSettings.waitForEvent('close'),
      app.electron().evaluate(({BrowserWindow}) => {
        const win = BrowserWindow.getAllWindows().find(window =>
          window.webContents.getURL().includes('window=screens'),
        );
        if (win === undefined) {
          throw new Error('Screen settings window not found');
        }
        win.close();
      }),
    ]);
    await expect
      .poll(
        () =>
          page.evaluate<boolean>(`window.llp.settings.get({name:'screens'}).then(d =>
            d.value.screens.some(s => s.name === '점검 화면' && s.offset.x === 12))`),
        {timeout: WAIT},
      )
      .toBe(true);

    await page.getByRole('tab', {name: '테마'}).click();

    await page.getByRole('button', {name: '새 테마'}).click();
    const theme = page.getByRole('option', {name: '새 테마'});
    await theme.click({button: 'right'});
    await page.getByRole('menuitem', {name: '이름 바꾸기'}).click();
    const themeName = page.getByRole('textbox', {name: '새 테마 이름'});
    await themeName.fill('점검 테마');
    await themeName.press('Enter');
    await expect
      .poll(
        () =>
          page.evaluate<boolean>(`window.llp.settings.get({name:'themes'}).then(d =>
            d.value.themes.some(theme => theme.name === '점검 테마'))`),
        {timeout: WAIT},
      )
      .toBe(true);
    await page.getByRole('tab', {name: '진행'}).click();
    await openToolTab(page, '메시지');
    expect(await page.getByLabel('메시지 미리보기').innerText()).toBe(
      '창작 안내 문장',
    );
    await page.getByRole('button', {name: '보내기'}).click();
    const isShowing = (): Promise<boolean> =>
      page.evaluate<boolean>(`window.llp.live.get().then(live =>
        live.layers.message?.items?.some(item => item.text === '창작 안내 문장') === true)`);
    await expect.poll(isShowing, {timeout: WAIT}).toBe(true);
    expect(
      await page.evaluate<number>(`window.llp.live.get().then(live => {
        const item = live.layers.message.items.find(x => x.text === '창작 안내 문장');
        return item.expiresAt - item.startedAt;
      })`),
    ).toBe(30_000);
    await expect.poll(isShowing, {timeout: 45_000, interval: 500}).toBe(false);

    const quittingSettings = await openScreenSettings(page, app.electron());
    await quittingSettings
      .getByRole('textbox', {name: '이름'})
      .fill('종료 저장 화면');
    expect(await app.stop()).toBe(false);
    const reopened = await app.start();
    const restoredSettings = await openScreenSettings(reopened, app.electron());
    expect(
      await restoredSettings.getByRole('textbox', {name: '이름'}).inputValue(),
    ).toBe('종료 저장 화면');
    expect(
      await restoredSettings
        .getByRole('spinbutton', {name: '가로 위치'})
        .inputValue(),
    ).toBe('12');
  },
);
