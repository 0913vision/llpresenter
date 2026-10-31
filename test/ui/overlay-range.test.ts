import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {offscreenApp} from './electron-app';

const SONG = '77000000-0000-4000-8000-000000000001';
const SERVICE = '77000000-0000-4000-8000-000000000002';
const ITEM = '77000000-0000-4000-8000-000000000003';
const RANGES = [
  {name: 'Range three', from: 1, to: 3},
  {name: 'Range two', from: 4, to: 5},
  {name: 'Range one', from: 6, to: 6},
] as const;

interface Segment {
  readonly rowTop: number;
  readonly rowBottom: number;
  readonly barTop: number;
  readonly barBottom: number;
  readonly caption: string;
}

it(
  'covers full overlay rows with separate adjacent ranges in the real window',
  {timeout: 240_000},
  async () => {
    const app = await offscreenApp();
    const root = join(app.data, 'LoveLight');
    await mkdir(join(root, 'Songs'), {recursive: true});
    await mkdir(join(root, 'Services'), {recursive: true});
    await writeFile(
      join(app.data, 'app.json'),
      JSON.stringify({
        format: 'llapp',
        schemaVersion: 1,
        lastServiceId: SERVICE,
      }),
      'utf8',
    );
    await writeFile(
      join(root, 'Songs', `${SONG}.llsong`),
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 2,
        id: SONG,
        title: 'Invented overlay song',
        groups: [
          {
            id: '77000000-0000-4000-8000-000000000004',
            name: 'Invented group',
            slides: Array.from({length: 6}, (_, index) => ({
              lines: [`Invented line ${index + 1}`],
            })),
          },
        ],
        arrangements: [],
      }),
      'utf8',
    );
    await writeFile(
      join(root, 'Services', `${SERVICE}.llservice`),
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id: SERVICE,
        name: 'Invented overlay service',
        date: '2026-01-01T10:00',
        order: [
          {
            id: ITEM,
            song: SONG,
            overlays: RANGES.map((range, index) => ({
              ...range,
              id: `77000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
              screens: [],
              content: {text: 'Invented caption'},
            })),
          },
        ],
      }),
      'utf8',
    );

    const page = await app.start();
    await app.electron().evaluate(({BrowserWindow}) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.setBounds({width: 1440, height: 1000});
      }
    });
    await page.getByRole('tab', {name: '준비'}).click();
    await page
      .getByRole('listbox', {name: '예배 순서'})
      .getByRole('option', {name: 'Invented overlay song'})
      .click();
    const table = page.getByRole('table', {name: '슬라이드와 오버레이'});
    await table
      .getByRole('button', {name: '슬라이드 6', exact: true})
      .waitFor();
    const geometry = await page.evaluate<{
      gap: number;
      segments: Segment[];
    }>(`(() => {
    const table = document.querySelector('[role="table"][aria-label="슬라이드와 오버레이"]');
    const rows = [...table.querySelectorAll('[aria-rowindex]')];
    return {
      gap: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-2')),
      segments: rows.map(row => {
        const button = row.querySelector('[role="cell"]:last-child button');
        const rowBox = row.getBoundingClientRect();
        const buttonBox = button.getBoundingClientRect();
        const bar = getComputedStyle(button, '::before');
        const top = buttonBox.top + Number.parseFloat(bar.top);
        return {rowTop: rowBox.top, rowBottom: rowBox.bottom,
          barTop: top, barBottom: top + Number.parseFloat(bar.height),
          caption: button.textContent.trim()};
      }),
    };
  })()`);
    expect(geometry.gap).toBeGreaterThan(0);
    expect(geometry.segments).toHaveLength(6);
    for (const range of RANGES) {
      const segments = geometry.segments.slice(range.from - 1, range.to);
      for (const [index, segment] of segments.entries()) {
        expect(segment.barTop).toBeCloseTo(
          segment.rowTop + (index === 0 ? geometry.gap : 0),
          1,
        );
        expect(segment.barBottom).toBeCloseTo(
          segment.rowBottom -
            (index === segments.length - 1 ? geometry.gap : 0),
          1,
        );
        expect(segment.caption).toBe(index === 0 ? range.name : '');
      }
    }
    for (const range of RANGES.slice(0, -1)) {
      const end = geometry.segments[range.to - 1];
      const next = geometry.segments[range.to];
      if (end === undefined || next === undefined) {
        throw new Error('Missing range edge');
      }
      expect(next.barTop - end.barBottom).toBeCloseTo(geometry.gap * 2, 1);
    }
  },
);
