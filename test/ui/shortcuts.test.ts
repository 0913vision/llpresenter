import {expect, it} from 'vitest';
import {offscreenApp} from './electron-app';
import {seedShortcutData, SHORTCUT_ITEM, SHORTCUT_MACRO} from './shortcut-data';

const WAIT = 30_000;

it(
  'remaps commands from a real settings file through focus precedence and updates open menus',
  {timeout: 240_000},
  async () => {
    const app = await offscreenApp();
    await seedShortcutData(app.data);
    const page = await app.start();
    const showing = (): Promise<number | null> =>
      page.evaluate<number | null>(
        `window.llp.live.get().then(live => live.layers.slide?.itemId === '${SHORTCUT_ITEM}' ? live.layers.slide.position : null)`,
      );
    const selected = (name: string): Promise<string | null> =>
      page.getByRole('tab', {name, exact: true}).getAttribute('aria-selected');
    await page
      .getByRole('listbox', {name: '예배 순서'})
      .getByRole('option', {name: '단축키 점검 곡'})
      .click();
    const grid = page.getByRole('listbox', {name: '슬라이드', exact: true});
    await grid.getByRole('option').first().click();
    await expect.poll(showing, {timeout: WAIT}).toBe(0);
    await grid.getByRole('option').first().press('F9');
    await expect.poll(showing, {timeout: WAIT}).toBe(1);
    const button = page.getByRole('button', {name: '가사 지우기', exact: true});
    await button.focus();
    await page.keyboard.press('F9');
    await expect.poll(showing, {timeout: WAIT}).toBe(2);

    await page.keyboard.press('Control+Alt+Digit9');
    await expect.poll(() => selected('준비'), {timeout: WAIT}).toBe('true');
    await page.keyboard.press('Control+Alt+KeyU');
    await expect
      .poll(
        () =>
          page.evaluate<string>(
            'window.llp.live.get().then(live => live.lastMacroId)',
          ),
        {timeout: WAIT},
      )
      .toBe(SHORTCUT_MACRO);
    const lyrics = page.getByRole('textbox', {name: '슬라이드 1 가사'});
    await page
      .getByRole('listbox', {name: '라이브러리'})
      .getByRole('option', {name: /단축키 점검 곡/})
      .dblclick();
    await lyrics.fill('창작 분리 문장');
    await lyrics.press('Control+Alt+Enter');
    await expect
      .poll(
        () => page.getByRole('textbox', {name: /슬라이드 \d+ 가사/}).count(),
        {timeout: WAIT},
      )
      .toBe(5);
    await page
      .getByRole('textbox', {name: '곡 제목'})
      .press('Control+Alt+Digit8');
    await expect.poll(() => selected('진행'), {timeout: WAIT}).toBe('true');
    await page.keyboard.press('Control+Alt+KeyK');
    const search = page.getByRole('combobox', {name: '검색', exact: true});
    expect(
      await page.evaluate<boolean>(
        'document.activeElement?.getAttribute("aria-label") === "검색"',
      ),
    ).toBe(true);
    await search.fill('점검');
    await search.press('F9');
    expect(await showing()).toBe(2);
    await page.evaluate(
      'document.querySelector(\'input[aria-label="검색"]\')?.setAttribute("data-shortcut-recording", "")',
    );
    expect(await search.getAttribute('data-shortcut-recording')).toBe('');
    expect(
      await page.evaluate<boolean>(
        'document.activeElement?.getAttribute("aria-label") === "검색"',
      ),
    ).toBe(true);
    await page.keyboard.press('F8');
    expect(await showing()).toBe(2);
    await page.evaluate(
      'document.querySelector(\'input[aria-label="검색"]\')?.removeAttribute("data-shortcut-recording")',
    );
    await search.press('Escape');

    await page.getByRole('menuitem', {name: '보기', exact: true}).click();
    const menu = page.getByRole('menu', {name: '보기', exact: true});
    expect(
      await menu.getByRole('menuitem', {name: '준비', exact: true}).innerText(),
    ).toContain('Ctrl Alt 9');
    await page.keyboard.press('Control+Alt+Digit9');
    expect(await selected('진행')).toBe('true');
    await page.keyboard.press('F8');
    await expect.poll(showing, {timeout: WAIT}).toBeNull();
    const zoom = await page.evaluate<number>('window.llp.ui.getZoom()');
    await page.keyboard.press('Control+Alt+Equal');
    await expect
      .poll(() => page.evaluate<number>('window.llp.ui.getZoom()'), {
        timeout: WAIT,
      })
      .toBe(zoom + 10);
    expect(await menu.isVisible()).toBe(true);
    await page.evaluate(
      `window.llp.settings.get({name:'shortcuts'}).then(document => window.llp.settings.edit({type:'settings.update',name:'shortcuts',baseRevision:document.revision,value:{...document.value,bindings:{...document.value.bindings,'workspace.prep':[{code:'Digit7',mods:['ctrl','alt']}]}}}))`,
    );
    await expect
      .poll(
        () =>
          menu.getByRole('menuitem', {name: '준비', exact: true}).innerText(),
        {timeout: WAIT},
      )
      .toContain('Ctrl Alt 7');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+Alt+KeyN');
    const dialog = page.getByRole('dialog', {name: '새 예배'});
    await expect.poll(() => dialog.isVisible(), {timeout: WAIT}).toBe(true);
    await page.keyboard.press('Control+Alt+Digit7');
    expect(await selected('진행')).toBe('true');
    await page.keyboard.press('F8');
    await expect.poll(showing, {timeout: WAIT}).not.toBeNull();
    await dialog.getByRole('button', {name: '취소', exact: true}).click();
    await page.keyboard.press('Control+Alt+Digit7');
    await expect.poll(() => selected('준비'), {timeout: WAIT}).toBe('true');
    await page.keyboard.press('Control+Alt+Digit1');
    await expect
      .poll(
        () =>
          app
            .electron()
            .windows()
            .some(window => window.url().includes('window=screens')),
        {timeout: WAIT},
      )
      .toBe(true);
    const screensWindow = app
      .electron()
      .windows()
      .find(window => window.url().includes('window=screens'));
    if (screensWindow === undefined) {
      throw new Error('Screen settings window did not open');
    }
    await screensWindow.getByRole('main', {name: '화면 설정'}).waitFor();
    await screensWindow.keyboard.press('F8');
    await expect.poll(showing, {timeout: WAIT}).toBeNull();
    expect(
      await page.evaluate<boolean>(
        `window.llp.settings.get({name:'shortcuts'}).then(document => document.value.bindings['future.command'][0].code === 'KeyW' && document.value.bindings['workspace.screens'] === undefined)`,
      ),
    ).toBe(true);
  },
);
