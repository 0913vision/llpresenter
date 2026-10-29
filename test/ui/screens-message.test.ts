import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {offscreenApp} from './electron-app';

const WAIT = 30_000;

it(
  'saves screen changes, applies a Look and expires a timed message',
  {timeout: 240_000},
  async () => {
    const app = await offscreenApp();
    const settings = join(app.data, 'LoveLight', '설정');
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
    await page.getByRole('tab', {name: '화면 설정'}).click();
    const name = page.getByRole('textbox', {name: '이름'});
    await name.fill('점검 화면');
    await name.press('Enter');
    const offset = page.getByRole('spinbutton', {name: '가로 위치'});
    await offset.fill('12');
    await offset.press('Enter');
    await expect
      .poll(
        () =>
          page.evaluate<boolean>(`window.llp.settings.get({name:'screens'}).then(d =>
            d.value.screens.some(s => s.name === '점검 화면' && s.offset.x === 12))`),
        {timeout: WAIT},
      )
      .toBe(true);

    await page.getByRole('button', {name: '새 Look'}).click();
    const lookName = page.getByRole('textbox', {name: 'Look 이름'});
    await lookName.fill('점검 Look');
    await lookName.press('Enter');
    await expect
      .poll(
        () =>
          page.evaluate<boolean>(`window.llp.settings.get({name:'looks'}).then(d =>
            d.value.looks.some(look => look.name === '점검 Look'))`),
        {timeout: WAIT},
      )
      .toBe(true);
    await page.getByRole('button', {name: 'Look', exact: true}).click();
    await page.getByRole('menuitemradio', {name: '점검 Look'}).click();
    await expect
      .poll(
        () =>
          page.evaluate<boolean>(`Promise.all([window.llp.settings.get({name:'looks'}),
            window.llp.live.get()]).then(([d, live]) =>
              d.value.looks.find(look => look.name === '점검 Look')?.id === live.lookId)`),
        {timeout: WAIT},
      )
      .toBe(true);

    await page.getByRole('tab', {name: '진행'}).click();
    await page.getByRole('button', {name: '더 보기'}).click();
    await page.getByRole('menuitemradio', {name: '메시지'}).click();
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

    await app.stop();
    const reopened = await app.start();
    await reopened.getByRole('tab', {name: '화면 설정'}).click();
    expect(
      await reopened.getByRole('textbox', {name: '이름'}).inputValue(),
    ).toBe('점검 화면');
    expect(
      await reopened.getByRole('spinbutton', {name: '가로 위치'}).inputValue(),
    ).toBe('12');
  },
);
