import {cleanup, fireEvent, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createMemoryColumnWidthStore} from './columnWidthStore';
import {Workspace} from './Workspace';

const POINTER_ID = 1;

function setWindowWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
}

function gridOf(container: HTMLElement): HTMLElement {
  const grid = container.querySelector('main');
  if (!grid) throw new Error('The workspace grid is missing');
  return grid;
}

function gapOf(container: HTMLElement, column: 'left' | 'right'): HTMLElement {
  const gap = container.querySelector<HTMLElement>(`[data-gap="${column}"]`);
  if (!gap) throw new Error(`The ${column} gap is missing`);
  return gap;
}

function widthsOf(grid: HTMLElement): {left: string; right: string} {
  return {
    left: grid.style.getPropertyValue('--ll-col-left'),
    right: grid.style.getPropertyValue('--ll-col-right'),
  };
}

function dragGap(gap: HTMLElement, fromX: number, toX: number): void {
  fireEvent.pointerDown(gap, {
    pointerId: POINTER_ID,
    button: 0,
    clientX: fromX,
  });
  fireEvent.pointerMove(gap, {pointerId: POINTER_ID, clientX: toX});
  fireEvent.pointerUp(gap, {pointerId: POINTER_ID, clientX: toX});
}

beforeEach(() => {
  setWindowWidth(1920);
  HTMLElement.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Workspace column gaps', () => {
  it('shows the default widths of the size class', () => {
    const {container} = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    expect(widthsOf(gridOf(container))).toEqual({
      left: '280px',
      right: '480px',
    });
  });

  it('resizes the left column by dragging its gap and captures the pointer', () => {
    const {container} = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const gap = gapOf(container, 'left');
    dragGap(gap, 300, 340);
    expect(gap.setPointerCapture).toHaveBeenCalledWith(POINTER_ID);
    expect(widthsOf(gridOf(container))).toEqual({
      left: '320px',
      right: '480px',
    });
  });

  it('resizes the right column when its gap moves left', () => {
    const {container} = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    dragGap(gapOf(container, 'right'), 1400, 1350);
    expect(widthsOf(gridOf(container))).toEqual({
      left: '280px',
      right: '530px',
    });
  });

  it('ignores moves before a press and presses of other buttons', () => {
    const {container} = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const gap = gapOf(container, 'left');
    fireEvent.pointerMove(gap, {pointerId: POINTER_ID, clientX: 500});
    fireEvent.pointerDown(gap, {
      pointerId: POINTER_ID,
      button: 2,
      clientX: 300,
    });
    fireEvent.pointerMove(gap, {pointerId: POINTER_ID, clientX: 500});
    expect(widthsOf(gridOf(container))).toEqual({
      left: '280px',
      right: '480px',
    });
  });

  it('stops dragging when the pointer capture is lost', () => {
    const {container} = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const gap = gapOf(container, 'left');
    fireEvent.pointerDown(gap, {
      pointerId: POINTER_ID,
      button: 0,
      clientX: 300,
    });
    fireEvent.pointerMove(gap, {pointerId: POINTER_ID, clientX: 320});
    fireEvent.lostPointerCapture(gap, {pointerId: POINTER_ID});
    fireEvent.pointerMove(gap, {pointerId: POINTER_ID, clientX: 400});
    expect(widthsOf(gridOf(container))).toEqual({
      left: '300px',
      right: '480px',
    });
  });

  it('remembers the widths per size class across a class change', () => {
    const store = createMemoryColumnWidthStore();
    const {container, rerender} = render(
      <Workspace id="show" sizeClass="normal" store={store} />,
    );
    dragGap(gapOf(container, 'left'), 300, 340);

    setWindowWidth(2560);
    rerender(<Workspace id="show" sizeClass="wide" store={store} />);
    expect(widthsOf(gridOf(container))).toEqual({
      left: '320px',
      right: '560px',
    });

    setWindowWidth(1920);
    rerender(<Workspace id="show" sizeClass="normal" store={store} />);
    expect(widthsOf(gridOf(container))).toEqual({
      left: '320px',
      right: '480px',
    });
  });

  it('keeps the widths when the workspace changes', () => {
    const store = createMemoryColumnWidthStore();
    const {container, rerender} = render(
      <Workspace id="show" sizeClass="normal" store={store} />,
    );
    dragGap(gapOf(container, 'left'), 300, 340);
    rerender(<Workspace id="prep" sizeClass="normal" store={store} />);
    expect(widthsOf(gridOf(container))).toEqual({
      left: '320px',
      right: '480px',
    });
  });

  it('shrinks the columns on screen when the window narrows', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 0;
    });
    const store = createMemoryColumnWidthStore();
    const {container} = render(
      <Workspace id="show" sizeClass="normal" store={store} />,
    );
    dragGap(gapOf(container, 'right'), 1400, 1160);
    dragGap(gapOf(container, 'left'), 300, 420);
    expect(widthsOf(gridOf(container)).right).toBe('720px');

    setWindowWidth(1600);
    fireEvent(window, new Event('resize'));
    expect(widthsOf(gridOf(container))).toEqual({
      left: '400px',
      right: '624px',
    });
    expect(store.load('normal')).toEqual({left: 400, right: 720});
  });

  it('removes the resize listener when it unmounts', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const {unmount} = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    unmount();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
