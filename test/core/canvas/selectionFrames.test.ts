import {expect, it} from 'vitest';
import {translateFrames} from '@core/canvas/selectionFrames';

it('clamps the whole group at the canvas edge without changing member gaps or sizes', () => {
  const members = [
    {id: 'a', frame: {x: 10, y: 20, w: 20, h: 20}},
    {id: 'b', frame: {x: 70, y: 40, w: 20, h: 20}},
  ];
  expect(
    translateFrames(members, {x: 40, y: -50}, {width: 100, height: 100}),
  ).toEqual([
    {id: 'a', frame: {x: 20, y: 0, w: 20, h: 20}},
    {id: 'b', frame: {x: 80, y: 20, w: 20, h: 20}},
  ]);
});
