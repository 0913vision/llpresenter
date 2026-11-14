import {expect, it} from 'vitest';
import type {ServiceRow, SlideTile} from '@core/presentation/model';
import {servicePicturePlan} from '@core/presentation/transitionPictures';

const plain: SlideTile = {label: null, labelColor: 'none', lines: []};
const wipe: SlideTile = {...plain, transition: {kind: 'wipe', sec: 1}};
const cut: SlideTile = {...plain, transition: {kind: 'none', sec: 1}};

it('plans every slide in service order, including cuts and effects', () => {
  const rows: ServiceRow[] = [
    {kind: 'song', id: 'a', title: 'A'},
    {kind: 'header', id: 'heading', title: 'Heading'},
    {kind: 'slides', id: 'b', title: 'B', form: 'blank'},
  ];
  expect(
    servicePicturePlan(rows, {a: [plain, wipe, cut], b: [wipe, plain]}),
  ).toEqual([
    {itemId: 'a', index: 0},
    {itemId: 'a', index: 1},
    {itemId: 'a', index: 2},
    {itemId: 'b', index: 0},
    {itemId: 'b', index: 1},
  ]);
  expect(servicePicturePlan(rows, {})).toEqual([]);
});
