import {expect, it} from 'vitest';
import type {ServiceRow, SlideTile} from '@core/presentation/model';
import {transitionPicturePlan} from '@core/presentation/transitionPictures';

const plain: SlideTile = {label: null, labelColor: 'none', lines: []};
const wipe: SlideTile = {...plain, transition: {kind: 'wipe', sec: 1}};
const cut: SlideTile = {...plain, transition: {kind: 'none', sec: 1}};

it('plans only effect slides and their previous slides, across item boundaries', () => {
  const rows: ServiceRow[] = [
    {kind: 'song', id: 'a', title: 'A'},
    {kind: 'header', id: 'heading', title: 'Heading'},
    {kind: 'slides', id: 'b', title: 'B', form: 'blank'},
  ];
  expect(
    transitionPicturePlan(rows, {a: [plain, wipe, cut], b: [wipe, plain]}),
  ).toEqual([
    {itemId: 'a', index: 0},
    {itemId: 'a', index: 1},
    {itemId: 'a', index: 2},
    {itemId: 'b', index: 0},
  ]);
  expect(transitionPicturePlan(rows, {a: [plain, cut], b: [plain]})).toEqual(
    [],
  );
});
