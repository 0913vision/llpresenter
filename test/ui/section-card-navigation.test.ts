import {parseRecoveryRecord} from '@core/schema/recoveryRecord';
import {it, expect} from 'vitest';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {offscreenApp} from './electron-app';
import {killProcessTree} from '../../scripts/process-tree.mts';

const SERVICE = '55000000-0000-4000-8000-000000000001';
const FIRST = '55000000-0000-4000-8000-000000000002';
const CARD = '55000000-0000-4000-8000-000000000003';
const NEXT = '55000000-0000-4000-8000-000000000004';
const MAIN = '00000000-0000-4000-8000-000000000001';
const slide = (n: number, text: string) => ({
  id: `55000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  text,
});
it(
  'navigates and recovers an opening card offscreen',
  {timeout: 240000},
  async () => {
    const app = await offscreenApp();
    const root = join(app.data, 'LoveLight', 'Services');
    await mkdir(root, {recursive: true});
    await writeFile(
      join(app.data, 'app.json'),
      JSON.stringify({
        format: 'llapp',
        schemaVersion: 1,
        lastServiceId: SERVICE,
      }),
    );
    await writeFile(
      join(root, `${SERVICE}.llservice`),
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id: SERVICE,
        name: 'Navigation',
        date: '2026-11-08T11:30',
        order: [
          {
            id: FIRST,
            slides: {
              form: 'blank',
              name: 'Before',
              slides: [slide(10, 'Before')],
            },
          },
          {
            id: CARD,
            sectionCard: {
              name: 'Card',
              english: 'Section',
              theme: '00000000-0000-4000-8000-000000000111',
            },
            slides: {
              form: 'blank',
              name: 'Content',
              slides: [slide(11, 'Content')],
            },
          },
          {
            id: NEXT,
            slides: {
              form: 'blank',
              name: 'After',
              slides: [slide(12, 'After')],
            },
          },
        ],
      }),
    );
    let page = await app.start();
    await page.setViewportSize({width: 1600, height: 900});
    const live = async () =>
      page.evaluate<{
        id: string | null;
        position: number | null;
        card: boolean;
      }>(
        `window.llp.live.get().then(s=>({id:s.layers.slide?.itemId??null,position:s.layers.slide?.position??null,card:!!s.layers.slide?.sectionCard}))`,
      );
    const expectLive = async (id: string, position: number) =>
      expect
        .poll(
          async () => {
            const value = await live();
            return [value.id, value.position];
          },
          {timeout: 30000},
        )
        .toEqual([id, position]);
    await page.getByRole('menuitem', {name: '보기', exact: true}).click();
    const continuous = page.getByRole('menuitemcheckbox', {
      name: '이어서 진행',
    });
    if ((await continuous.getAttribute('aria-checked')) !== 'true') {
      await continuous.click();
    } else await page.keyboard.press('Escape');
    const order = page.getByRole('listbox', {name: '예배 순서'});
    await order.getByRole('option', {name: 'Before'}).click();
    await page
      .getByRole('listbox', {name: '슬라이드'})
      .getByRole('option')
      .first()
      .click();
    await expectLive(FIRST, 0);
    await page.keyboard.press('ArrowRight');
    await expectLive(CARD, 0);
    await page.keyboard.press('ArrowRight');
    await expectLive(CARD, 1);
    await page.keyboard.press('ArrowLeft');
    await expectLive(CARD, 0);
    await page.keyboard.press('ArrowRight');
    await expectLive(CARD, 1);
    await page.keyboard.press('ArrowRight');
    await expectLive(NEXT, 0);
    await order.getByRole('option', {name: 'Content'}).click();
    await page.keyboard.press('Control+ArrowDown');
    await expect
      .poll(
        () =>
          order
            .getByRole('option', {name: 'After'})
            .getAttribute('aria-selected'),
        {timeout: 30000},
      )
      .toBe('true');
    await order.getByRole('option', {name: 'Content'}).click();
    await page
      .getByRole('listbox', {name: '슬라이드'})
      .getByRole('option')
      .first()
      .click();
    await expectLive(CARD, 0);
    await page.evaluate(
      `window.llp.live.send({type:'output.set',screenId:'${MAIN}',on:true})`,
    );
    const record = join(app.data, 'recovery', 'live.json');
    await expect
      .poll(
        async () => {
          try {
            const parsed = parseRecoveryRecord(await readFile(record, 'utf8'));
            if (!parsed.ok) return false;
            const state = parsed.value.data.state;
            return (
              state.layers.slide?.itemId === CARD &&
              state.layers.slide.position === 0 &&
              state.layers.slide.sectionCard !== undefined &&
              state.outputs[MAIN] === true
            );
          } catch {
            return false;
          }
        },
        {timeout: 30000},
      )
      .toBe(true);
    const child = app.electron().process();
    if (child.pid === undefined) throw Error('missing pid');
    const exited = new Promise<void>(resolve =>
      child.once('exit', () => resolve()),
    );
    await killProcessTree(child.pid);
    await exited;
    await app.stop();
    page = await app.start();
    await page
      .getByRole('alertdialog', {name: '출력 내용을 복구할까요?'})
      .getByRole('button', {name: '복구'})
      .click();
    await expectLive(CARD, 0);
    expect((await live()).card).toBe(true);
    await page
      .getByRole('listbox', {name: '\uc608\ubc30 \uc21c\uc11c'})
      .getByRole('option', {name: 'Content'})
      .click();
  },
);
