import {it, expect} from 'vitest';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chunkedTranslationFile} from '@fixtures/core/bible/testFiles';
import {entryFor} from '@core/bible/split/splitCache';
import {parseRecoveryRecord} from '@core/schema/recoveryRecord';
import {offscreenApp} from './electron-app';

const SERVICE = '55000000-0000-4000-8000-000000000001';
const CARD = '55000000-0000-4000-8000-000000000003';
const NEXT = '55000000-0000-4000-8000-000000000004';
const MAIN = '00000000-0000-4000-8000-000000000001';
it(
  'navigates Bible cards across verse cuts and recovers offscreen',
  {timeout: 240000},
  async () => {
    const app = await offscreenApp();
    const root = join(app.data, 'LoveLight');
    await mkdir(join(root, 'Services'), {recursive: true});
    await mkdir(join(root, 'Settings'), {recursive: true});
    await mkdir(join(app.data, 'bible'), {recursive: true});
    await writeFile(
      join(app.data, 'bible', 'sample.llbible'),
      chunkedTranslationFile().bytes,
    );
    await writeFile(
      join(root, 'Settings', 'bible.json'),
      JSON.stringify({
        format: 'llsettings.bible',
        schemaVersion: 1,
        translations: [
          {
            id: 'sample',
            name: 'Invented',
            lang: 'ko',
            file: 'sample.llbible',
            default: true,
          },
        ],
        recents: [],
      }),
    );
    await writeFile(
      join(app.data, 'app.json'),
      JSON.stringify({
        format: 'llapp',
        schemaVersion: 1,
        lastServiceId: SERVICE,
      }),
    );
    await writeFile(
      join(root, 'Services', `${SERVICE}.llservice`),
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id: SERVICE,
        name: 'Bible card',
        date: '2026-11-08T11:30',
        order: [
          {
            id: CARD,
            sectionCard: {
              name: 'Card',
              english: 'Section',
              theme: '00000000-0000-4000-8000-000000000111',
            },
            bible: {
              translation: 'sample',
              ref: '요한복음 3:16-17',
              split: 'verse',
              reference: 'every',
              verseNumbers: true,
              translationName: false,
            },
          },
          {
            id: NEXT,
            slides: {
              form: 'blank',
              name: 'After',
              slides: [
                {id: '55000000-0000-4000-8000-000000000011', text: 'After'},
              ],
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
        label: string | null;
        card: boolean;
      }>(
        `window.llp.live.get().then(s=>({id:s.layers.slide?.itemId??null,position:s.layers.slide?.position??null,label:s.layers.slide?.label??null,card:!!s.layers.slide?.sectionCard}))`,
      );
    const waitLabel = async (label: string) =>
      expect
        .poll(async () => (await live()).label, {timeout: 30000})
        .toBe(label);
    const order = page.getByRole('listbox', {name: '예배 순서'});
    await order.getByRole('option', {name: '요한복음 3:16~17'}).click();
    const grid = page.getByRole('listbox', {name: '슬라이드'});
    await expect
      .poll(() => grid.getByRole('option').count(), {timeout: 30000})
      .toBeGreaterThanOrEqual(3);
    await grid.getByRole('option').first().click();
    await waitLabel('Card');
    await page.keyboard.press('Shift+ArrowLeft');
    expect((await live()).label).toBe('Card');
    await page.keyboard.press('Shift+ArrowRight');
    await waitLabel('3:16');
    await page.keyboard.press('ArrowLeft');
    await waitLabel('Card');
    await page.keyboard.press('ArrowRight');
    await waitLabel('3:16');
    await page.keyboard.press('Shift+ArrowLeft');
    await waitLabel('3:15');
    await order.getByRole('option', {name: '요한복음 3:16~17'}).click();
    await grid.getByRole('option').last().click();
    await waitLabel('3:17');
    await page.keyboard.press('Shift+ArrowRight');
    await waitLabel('3:18');
    await order.getByRole('option', {name: '요한복음 3:16~17'}).click();
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
    await order.getByRole('option', {name: '요한복음 3:16~17'}).click();
    await grid.getByRole('option').first().click();
    await waitLabel('Card');
    const updateCut = async (cuts: number[]) => {
      const entry = entryFor(
        'Invented book 43, chapter 3, verse 16',
        cuts,
        '2026-11-10T00:00:00Z',
      );
      const result = await page.evaluate<boolean>(`(async () => {
        const entry = ${JSON.stringify(entry)};
        const doc = await window.llp.settings.get({name: 'bibleCuts'});
        if (doc.name !== 'bibleCuts') return false;
        const edit = await window.llp.settings.edit({
          type: 'settings.update',
          name: 'bibleCuts',
          baseRevision: doc.revision,
          value: {
            ...doc.value,
            entries: {
              ...doc.value.entries,
              sample: {...doc.value.entries.sample, '43:3:16': entry},
            },
          },
        });
        return edit.ok;
      })()`);
      expect(result).toBe(true);
    };
    await page.keyboard.press('Control+E');
    expect(await page.getByRole('dialog').count()).toBe(0);
    await updateCut([2]);
    await expect
      .poll(() => grid.getByRole('option').count(), {timeout: 30000})
      .toBeGreaterThanOrEqual(4);
    expect((await live()).label).toBe('Card');
    await grid.getByRole('option').nth(1).click();
    await waitLabel('3:16');
    await page.keyboard.press('Control+E');
    const splitDialog = page.getByRole('dialog', {
      name: '\uc808 \ub098\ub204\uae30',
    });
    await splitDialog.waitFor({state: 'visible', timeout: 30000});
    await page.keyboard.press('Escape');
    await splitDialog.waitFor({state: 'hidden'});
    await updateCut([]);
    await expect
      .poll(() => grid.getByRole('option').count(), {timeout: 30000})
      .toBe(3);
    expect((await live()).label).toBe('3:16');
    await grid.getByRole('option').first().click();
    await waitLabel('Card');
    await page.evaluate(
      `window.llp.live.send({type:'output.set',screenId:'${MAIN}',on:true})`,
    );
    const record = join(app.data, 'recovery', 'live.json');
    await expect
      .poll(
        async () => {
          try {
            const parsed = parseRecoveryRecord(await readFile(record, 'utf8'));
            return (
              parsed.ok &&
              parsed.value.data.state.layers.slide?.itemId === CARD &&
              parsed.value.data.state.layers.slide.sectionCard !== undefined &&
              parsed.value.data.state.outputs[MAIN] === true
            );
          } catch {
            return false;
          }
        },
        {timeout: 30000},
      )
      .toBe(true);
    await app.crash();
    page = await app.start();
    await page
      .getByRole('alertdialog', {name: '출력 내용을 복구할까요?'})
      .getByRole('button', {name: '복구'})
      .click();
    await waitLabel('Card');
    expect((await live()).card).toBe(true);
  },
);
