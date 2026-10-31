import {expect, it} from 'vitest';
import {fitTabIndices} from './fitTabs';

const fit = (available: number, selected = 0, widths = [50, 50, 50, 50]) =>
  fitTabIndices({widths, available, selected, more: 40, gap: 10});

it('shows every tab at the exact boundary without reserving overflow space', () => {
  expect(fit(230)).toEqual([0, 1, 2, 3]);
});

it('reserves the menu and gaps before taking a prefix of the tabs', () => {
  expect(fit(229)).toEqual([0, 1, 2]);
  expect(fit(160)).toEqual([0, 1]);
  expect(fit(159)).toEqual([0]);
});

it('puts a selected overflow tab in the last slot and accounts for its width', () => {
  expect(fit(160, 3)).toEqual([0, 3]);
  expect(fit(210, 3, [50, 50, 50, 120])).toEqual([3]);
  expect(fit(230, 3, [50, 50, 50, 120])).toEqual([0, 3]);
});

it('keeps the selected tab even when only one slot remains', () => {
  expect(fit(80, 2)).toEqual([2]);
  expect(fit(10, 0, [120])).toEqual([0]);
  expect(fit(10, 0, [])).toEqual([]);
});
