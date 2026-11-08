import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it} from 'vitest';
import {
  SlideTransitionControl,
  type SlideTransitionChange,
} from '@renderer/ui/SlideTransitionControl';
import type {SlideTransition} from '@core/schema/slideTransition';

it('applies rapid changes to the latest value while saved replies are delayed', () => {
  const initial: SlideTransition = {kind: 'wipe', dir: 'left', sec: 0.5};
  const updates: SlideTransitionChange[] = [];
  render(
    <SlideTransitionControl
      label="전환"
      value={initial}
      onChange={update => updates.push(update)}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '밀어내기'}));
  fireEvent.click(screen.getByRole('button', {name: '오른쪽으로'}));
  const time = screen.getByRole('spinbutton', {name: '전환 시간'});
  fireEvent.change(time, {target: {value: '2'}});
  fireEvent.keyDown(time, {key: 'Enter'});
  expect(updates.reduce((value, update) => update(value), initial)).toEqual({
    kind: 'push',
    dir: 'right',
    sec: 2,
  });
  fireEvent.click(screen.getByRole('button', {name: '없음'}));
  fireEvent.click(screen.getByRole('button', {name: '위로'}));
  expect(updates.reduce((value, update) => update(value), initial)).toEqual({
    kind: 'none',
    sec: 2,
  });
});
