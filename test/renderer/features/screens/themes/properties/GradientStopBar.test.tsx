import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {GradientBackground} from '@core/theme';
import {GradientStopBar} from '@renderer/features/screens/themes/properties/GradientStopBar';

const POINTER = 7;
const TWO: GradientBackground = {
  kind: 'gradient',
  angle: 90,
  stops: [
    {color: '#1E2761', position: 20},
    {color: '#F96167', position: 80},
  ],
};
const THREE: GradientBackground = {
  ...TWO,
  stops: [
    {color: '#1E2761', position: 20},
    {color: '#FFFFFF', position: 50},
    {color: '#F96167', position: 80},
  ],
};

beforeEach(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setUp(gradient: GradientBackground, reason?: string) {
  const props = {
    select: vi.fn<(index: number) => void>(),
    change: vi.fn<(gradient: GradientBackground) => void>(),
    add: vi.fn<(position: number) => number | undefined>(() => 1),
    remove: vi.fn<() => void>(),
    finish: vi.fn<() => void>(),
  };
  render(
    <GradientStopBar
      gradient={gradient}
      selected={0}
      reason={reason}
      select={props.select}
      change={props.change}
      add={props.add}
      remove={props.remove}
      begin={() => props.finish}
    />,
  );
  const bar = screen.getByRole('group', {name: '그라데이션 색상점'});
  const track = bar.firstElementChild;
  if (!(track instanceof HTMLElement)) throw new Error('No track');
  const width = (element: HTMLElement) =>
    vi
      .spyOn(element, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(100, 0, 200, 20));
  width(bar);
  width(track);
  return {...props, bar, track, handles: screen.getAllByRole('slider')};
}

it('moves a color by 1 % with an arrow key and by 10 % with Shift, passing it as the others when it does', () => {
  const {handles, change, select} = setUp(TWO);
  fireEvent.keyDown(handles[0] ?? document.body, {key: 'ArrowRight'});
  expect(change).toHaveBeenLastCalledWith({
    ...TWO,
    stops: [{color: '#1E2761', position: 21}, TWO.stops[1]],
  });
  fireEvent.keyDown(handles[1] ?? document.body, {
    key: 'ArrowLeft',
    shiftKey: true,
  });
  expect(change).toHaveBeenLastCalledWith({
    ...TWO,
    stops: [TWO.stops[0], {color: '#F96167', position: 70}],
  });
  expect(select).toHaveBeenLastCalledWith(1);
});

it('leaves arrows with Ctrl to the window', () => {
  const {handles, change} = setUp(TWO);
  fireEvent.keyDown(handles[0] ?? document.body, {
    key: 'ArrowRight',
    ctrlKey: true,
  });
  expect(change).not.toHaveBeenCalled();
});

it('deletes a color with Delete only while more than two are left', () => {
  const three = setUp(THREE);
  fireEvent.keyDown(three.handles[1] ?? document.body, {key: 'Delete'});
  expect(three.remove).toHaveBeenCalledOnce();
  cleanup();
  const two = setUp(TWO);
  fireEvent.keyDown(two.handles[0] ?? document.body, {key: 'Backspace'});
  expect(two.remove).not.toHaveBeenCalled();
});

it('adds a color where the bar is clicked', () => {
  const {track, add} = setUp(TWO);
  fireEvent.click(track, {clientX: 150});
  expect(add).toHaveBeenCalledWith(25);
});

it('drags a color with the pointer and ends the drag when the button is let go', () => {
  const {bar, handles, change, finish} = setUp(TWO);
  const first = handles[0] ?? document.body;
  fireEvent.pointerDown(first, {pointerId: POINTER, button: 0, clientX: 140});
  expect(bar.setPointerCapture).toHaveBeenCalledWith(POINTER);
  fireEvent.pointerMove(bar, {pointerId: POINTER, clientX: 200});
  expect(change).toHaveBeenLastCalledWith({
    ...TWO,
    stops: [{color: '#1E2761', position: 50}, TWO.stops[1]],
  });
  fireEvent.pointerMove(bar, {pointerId: POINTER + 1, clientX: 260});
  expect(change).toHaveBeenCalledOnce();
  fireEvent.pointerUp(bar, {pointerId: POINTER, clientX: 200});
  expect(finish).toHaveBeenCalledOnce();
  expect(bar.releasePointerCapture).toHaveBeenCalledWith(POINTER);
});

it('changes nothing while the theme can not be edited, and says why', () => {
  const {track, handles, add, change} = setUp(
    TWO,
    '기본 테마는 바꿀 수 없습니다.',
  );
  expect(handles.every(handle => handle.hasAttribute('disabled'))).toBe(true);
  expect(track.title).toBe('기본 테마는 바꿀 수 없습니다.');
  fireEvent.click(track, {clientX: 150});
  fireEvent.pointerDown(handles[0] ?? document.body, {
    pointerId: POINTER,
    button: 0,
    clientX: 140,
  });
  expect(add).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
});
