import {expect, it} from 'vitest';
import {nextFocus} from '@renderer/features/songs/import/useImportLabelWindow';

const rows = {count: 30, visible: 10};

it('crosses rows with Tab and moves pages, keeping a field its Home and End', () => {
  expect(
    nextFocus({key: 'Tab', shift: false}, {index: 3, part: 'button'}, rows),
  ).toEqual({index: 4, part: 'input'});
  expect(
    nextFocus({key: 'Tab', shift: true}, {index: 3, part: 'input'}, rows),
  ).toEqual({index: 2, part: 'button'});
  expect(
    nextFocus({key: 'Tab', shift: false}, {index: 3, part: 'input'}, rows),
  ).toBeUndefined();
  expect(
    nextFocus(
      {key: 'PageDown', shift: false},
      {index: 25, part: 'input'},
      rows,
    ),
  ).toEqual({index: 29, part: 'input'});
  expect(
    nextFocus({key: 'Home', shift: false}, {index: 7, part: 'button'}, rows),
  ).toEqual({index: 0, part: 'button'});
  expect(
    nextFocus({key: 'Home', shift: false}, {index: 7, part: 'input'}, rows),
  ).toBeUndefined();
});
