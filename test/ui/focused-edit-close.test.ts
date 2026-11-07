import type {ElectronApplication, Page} from 'playwright-core';
import {expect, it} from 'vitest';
import {offscreenApp} from './electron-app';

const WAIT = 30_000;

async function openScreenSettings(
  control: Page,
  app: ElectronApplication,
): Promise<Page> {
  await control.getByRole('menuitem', {name: '출력', exact: true}).click();
  await control.getByRole('menuitem', {name: '화면 설정…'}).click();
  const findSettings = () =>
    app.windows().find(page => page.url().includes('window=settings'));
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
  return settings;
}

it(
  'saves focused theme and screen edits on close and quit across a restart',
  {timeout: 180_000},
  async () => {
    const app = await offscreenApp();
    const page = await app.start();
    const settings = await openScreenSettings(page, app.electron());
    const offset = settings.getByRole('spinbutton', {name: '가로 위치'});
    await offset.fill('12');
    expect(
      await settings.evaluate<boolean>(
        `document.activeElement?.value === '12'`,
      ),
    ).toBe(true);
    await Promise.all([
      settings.waitForEvent('close'),
      app.electron().evaluate(({BrowserWindow}) => {
        const window = BrowserWindow.getAllWindows().find(window =>
          window.webContents.getURL().includes('window=settings'),
        );
        if (window === undefined) {
          throw new Error('Screen settings window not found');
        }
        window.close();
      }),
    ]);
    const quittingSettings = await openScreenSettings(page, app.electron());
    expect(
      await quittingSettings
        .getByRole('spinbutton', {name: '가로 위치'})
        .inputValue(),
    ).toBe('12');

    await page.getByRole('tab', {name: '테마'}).click();
    await page
      .getByRole('region', {name: '요소 추가'})
      .getByRole('button', {name: '글자', exact: true})
      .click();
    const content = page.getByRole('textbox', {name: '내용', exact: true});
    await content.fill('종료 저장 문장');
    const name = quittingSettings.getByRole('textbox', {name: '이름'});
    await name.fill('종료 저장 화면');
    expect(
      await page.evaluate<boolean>(
        `document.activeElement?.value === '종료 저장 문장'`,
      ),
    ).toBe(true);
    expect(
      await quittingSettings.evaluate<boolean>(
        `document.activeElement?.value === '종료 저장 화면'`,
      ),
    ).toBe(true);
    const stopStarted = performance.now();
    const stopping = app.stop();
    await page
      .getByRole('alertdialog')
      .getByRole('button', {name: '저장', exact: true})
      .click();
    const forced = await stopping;
    const quitMs = Math.round(performance.now() - stopStarted);
    console.info('Focused editor quit', {quitMs, forced});
    expect(forced, `Focused editor quit took ${quitMs} ms`).toBe(false);

    const reopened = await app.start();
    await expect
      .poll(
        () =>
          reopened.evaluate<boolean>(`window.llp.settings.get({name:'themes'}).then(document =>
      document.value.themes.some(theme => Object.values(theme.screens).some(layout =>
        layout.elements.some(element => element.kind === 'text' && element.content === '종료 저장 문장'))))`),
        {timeout: WAIT},
      )
      .toBe(true);
    const restoredSettings = await openScreenSettings(reopened, app.electron());
    expect(
      await restoredSettings.getByRole('textbox', {name: '이름'}).inputValue(),
    ).toBe('종료 저장 화면');
    expect(
      await restoredSettings
        .getByRole('spinbutton', {name: '가로 위치'})
        .inputValue(),
    ).toBe('12');
    expect(
      await app
        .electron()
        .evaluate(({BrowserWindow}) =>
          BrowserWindow.getAllWindows().every(window => !window.isVisible()),
        ),
    ).toBe(true);
  },
);
