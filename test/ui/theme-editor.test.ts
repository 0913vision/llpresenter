import {expect, it} from 'vitest';
import {offscreenApp} from './electron-app';

const WAIT = 30_000;

it(
  'edits screen layouts, pastes elements between screens, and flushes a focused theme property on close',
  {timeout: 180_000},
  async () => {
    const app = await offscreenApp();
    const page = await app.start();
    await app.electron().evaluate(({BrowserWindow}, url) => {
      const control = BrowserWindow.getAllWindows().find(
        window => window.webContents.getURL() === url,
      );
      if (control === undefined) throw new Error('Missing control window');
      control.setBounds({width: 1920, height: 1080});
    }, page.url());
    await page.getByRole('tab', {name: '테마'}).click();
    await page.getByRole('button', {name: '새 테마'}).click();
    const row = page.getByRole('option', {name: '새 테마'});
    await row.click({button: 'right'});
    await page.getByRole('menuitem', {name: '이름 바꾸기'}).click();
    const name = page.getByRole('textbox', {name: '새 테마 이름'});
    await name.fill('점검 테마');
    await name.press('Enter');
    await page
      .getByRole('region', {name: '요소 추가'})
      .getByRole('button', {name: '글', exact: true})
      .click();
    const content = page.getByRole('textbox', {name: '내용', exact: true});
    await content.fill('창작 점검 문장');
    await content.press('Control+Enter');
    await page.getByRole('spinbutton', {name: '크기', exact: true}).fill('72');
    await page
      .getByRole('spinbutton', {name: '크기', exact: true})
      .press('Enter');
    await expect
      .poll(
        () =>
          page.evaluate<boolean>(`window.llp.settings.get({name:'themes'}).then(document => {
    const theme = document.value.themes.find(theme => theme.name === '점검 테마');
    return Object.values(theme.screens).some(layout => layout.elements.some(element => element.kind === 'text' && element.content === '창작 점검 문장' && element.text.size === 72));
  })`),
        {timeout: WAIT},
      )
      .toBe(true);

    const source = await page.evaluate<string>(`(() => {
    const canvas = document.querySelector('[data-canvas]');
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent('keydown', {key:'a', code:'KeyA', ctrlKey:true, bubbles:true, cancelable:true}));
    const data = new DataTransfer();
    canvas.dispatchEvent(new ClipboardEvent('copy', {clipboardData:data, bubbles:true, cancelable:true}));
    return data.getData('text/plain');
  })()`);
    expect(source).toContain('llp.theme-elements');
    await page.getByRole('tab', {name: '화면', exact: true}).click();
    const color = page.getByRole('textbox', {name: '배경색', exact: true});
    await color.fill('#1C355C');
    await color.press('Enter');
    await expect
      .poll(
        () =>
          page.evaluate<string>(
            `getComputedStyle(document.querySelector('[data-canvas] svg')).backgroundColor`,
          ),
        {timeout: WAIT},
      )
      .toBe('rgb(28, 53, 92)');

    await page.getByRole('button', {name: '무대 화면 편집'}).click();
    await page.evaluate<undefined>(`(() => {
    const canvas = document.querySelector('[data-canvas]');
    const data = new DataTransfer();
    data.setData('text/plain', ${JSON.stringify(source)});
    canvas.dispatchEvent(new ClipboardEvent('paste', {clipboardData:data, bubbles:true, cancelable:true}));
  })()`);
    await expect
      .poll(
        () =>
          page.evaluate<boolean>(`window.llp.settings.get({name:'themes'}).then(document => {
    const theme = document.value.themes.find(theme => theme.name === '점검 테마');
    return Object.values(theme.screens).filter(layout => layout.elements.some(element => element.kind === 'text' && element.content === '창작 점검 문장')).length === 2;
  })`),
        {timeout: WAIT},
      )
      .toBe(true);
    await page
      .locator('[data-canvas]')
      .getByRole('button', {name: '글', exact: true})
      .click();
    const x = page.getByRole('spinbutton', {name: 'X', exact: true});
    expect(await x.inputValue()).toBe('560');
    await x.fill('600');
    await x.press('Enter');
    await page.getByRole('checkbox', {name: '채우기', exact: true}).click();
    await expect
      .poll(
        () =>
          page.evaluate<boolean>(`window.llp.settings.get({name:'themes'}).then(document => {
    const theme = document.value.themes.find(theme => theme.name === '점검 테마');
    return Object.values(theme.screens).some(layout => layout.elements.some(element => element.kind === 'text' && element.frame.x === 600 && element.box?.on === true));
  })`),
        {timeout: WAIT},
      )
      .toBe(true);
    expect(
      await page.locator('[data-canvas] [data-canvas-element]').count(),
    ).toBe(1);
    await page.evaluate<number>(
      `document.querySelector('section[aria-label="테마 속성"] [role="tabpanel"]').scrollTop = 0`,
    );
    await page.getByRole('tab', {name: '화면', exact: true}).click();
    await page
      .getByRole('radio', {name: '본 화면과 동일', exact: true})
      .click();
    await expect
      .poll(
        () =>
          page.evaluate<string>(
            `getComputedStyle(document.querySelector('[data-canvas] svg')).backgroundColor`,
          ),
        {timeout: WAIT},
      )
      .toBe('rgb(28, 53, 92)');
    await page.getByRole('radio', {name: '비움', exact: true}).click();
    await expect
      .poll(() => page.locator('[data-canvas] [data-canvas-element]').count(), {
        timeout: WAIT,
      })
      .toBe(0);
    await page.getByRole('radio', {name: '직접 배치', exact: true}).click();
    await page
      .locator('[data-canvas]')
      .getByRole('button', {name: '글', exact: true})
      .click();
    await page
      .getByRole('textbox', {name: '내용', exact: true})
      .fill('종료 저장 문장');
    expect(await app.stop()).toBe(false);
    const reopened = await app.start();
    await expect
      .poll(
        () =>
          reopened.evaluate<boolean>(`window.llp.settings.get({name:'themes'}).then(document => {
    const theme = document.value.themes.find(theme => theme.name === '점검 테마');
    return Object.values(theme.screens).some(layout => layout.elements.some(element => element.kind === 'text' && element.content === '종료 저장 문장' && element.frame.x === 600));
  })`),
        {timeout: WAIT},
      )
      .toBe(true);
    expect(
      await app
        .electron()
        .evaluate(({BrowserWindow}) =>
          BrowserWindow.getAllWindows().every(window => !window.isVisible()),
        ),
    ).toBe(true);
  },
);
