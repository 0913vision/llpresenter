import {cleanup, fireEvent, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {isColumnDragActive} from '@renderer/platform/drag';
import * as showState from '@renderer/session/show';
import {
  sampleService,
  seedSampleService,
} from '@renderer/session/testing/sampleService';
import {createMemoryColumnWidthStore} from './columnWidthStore';
import {Workspace} from './Workspace';
import {renderWithScreenSummaries as render} from '../../platform/testing/screenSummaries';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

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
  seedSampleService();
  setWindowWidth(1920);
  HTMLElement.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Workspace service header', () => {
  it.each(['narrow', 'normal', 'wide'] as const)(
    'shows the service name with the stable panel label at %s size',
    sizeClass => {
      render(
        <Workspace
          id="show"
          sizeClass={sizeClass}
          store={createMemoryColumnWidthStore()}
        />,
      );
      const panel = screen.getByRole('region', {name: '예배 순서'});
      expect(within(panel).getByText(sampleService.name)).toBeDefined();
      expect(within(panel).queryByText('예배 순서')).toBeNull();
      expect(
        within(panel).getByRole('listbox', {name: '예배 순서'}),
      ).toBeDefined();
    },
  );

  it('uses the generic panel name while no service is open', () => {
    showState.applyService(null);
    render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const panel = screen.getByRole('region', {name: '예배 순서'});
    expect(within(panel).getByText('예배 순서')).toBeDefined();
    expect(within(panel).queryByText(sampleService.name)).toBeNull();
    expect(within(panel).queryAllByRole('option')).toHaveLength(0);
  });

  it('keeps the read-only warning beside the service name', () => {
    showState.applyService({...sampleService, readOnly: true});
    render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const panel = screen.getByRole('region', {name: '예배 순서'});
    expect(within(panel).getByText(sampleService.name)).toBeDefined();
    expect(
      within(panel).getByRole('img', {
        name: '새 버전의 파일이라 읽기 전용으로 엽니다.',
      }),
    ).toBeDefined();
  });

  it('mounts the current service header and list in the 준비 workspace', () => {
    render(
      <Workspace
        id="prep"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const panel = screen.getByRole('region', {name: '예배 순서'});
    expect(within(panel).getByText(sampleService.name)).toBeDefined();
    expect(within(panel).getByRole('listbox').dataset['workspace']).toBe(
      'prep',
    );
  });
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

  it('lets only one pointer drag across both gaps', () => {
    const {container} = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const left = gapOf(container, 'left');
    const right = gapOf(container, 'right');
    fireEvent.pointerDown(left, {pointerId: 1, button: 0, clientX: 300});
    fireEvent.pointerDown(right, {pointerId: 2, button: 0, clientX: 1400});
    fireEvent.pointerMove(right, {pointerId: 2, clientX: 1300});
    fireEvent.pointerMove(left, {pointerId: 1, clientX: 340});
    fireEvent.pointerUp(right, {pointerId: 2, clientX: 1300});
    fireEvent.pointerMove(left, {pointerId: 1, clientX: 360});
    expect(left.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(widthsOf(gridOf(container))).toEqual({
      left: '340px',
      right: '480px',
    });
  });

  it('ignores a second pointer on the gap that is being dragged', () => {
    const {container} = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const gap = gapOf(container, 'left');
    fireEvent.pointerDown(gap, {pointerId: 1, button: 0, clientX: 300});
    fireEvent.pointerDown(gap, {pointerId: 2, button: 0, clientX: 500});
    fireEvent.pointerMove(gap, {pointerId: 2, clientX: 600});
    fireEvent.pointerUp(gap, {pointerId: 2, clientX: 600});
    fireEvent.pointerMove(gap, {pointerId: 1, clientX: 320});
    expect(gap.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(widthsOf(gridOf(container))).toEqual({
      left: '300px',
      right: '480px',
    });
  });

  it('can drag the other gap after the first drag ends', () => {
    const {container} = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    dragGap(gapOf(container, 'left'), 300, 340);
    dragGap(gapOf(container, 'right'), 1400, 1350);
    expect(widthsOf(gridOf(container))).toEqual({
      left: '320px',
      right: '530px',
    });
  });

  it('keeps a shrunk width unsaved when a gap is clicked without moving', () => {
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
    setWindowWidth(1600);
    fireEvent(window, new Event('resize'));

    dragGap(gapOf(container, 'right'), 1200, 1200);
    expect(store.load('normal')).toEqual({left: 400, right: 720});
  });

  it('fits the columns at once when the window shrinks during a drag', () => {
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

    const gap = gapOf(container, 'left');
    fireEvent.pointerDown(gap, {pointerId: 1, button: 0, clientX: 400});
    setWindowWidth(1600);
    fireEvent(window, new Event('resize'));
    expect(widthsOf(gridOf(container))).toEqual({
      left: '400px',
      right: '624px',
    });
    fireEvent.pointerUp(gap, {pointerId: 1, clientX: 400});
    expect(widthsOf(gridOf(container))).toEqual({
      left: '400px',
      right: '624px',
    });
  });

  it('marks a column drag as active from the press to the release', () => {
    const {container} = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const gap = gapOf(container, 'left');
    expect(isColumnDragActive()).toBe(false);
    fireEvent.pointerDown(gap, {pointerId: 1, button: 0, clientX: 300});
    expect(isColumnDragActive()).toBe(true);
    fireEvent.pointerUp(gap, {pointerId: 1, clientX: 300});
    expect(isColumnDragActive()).toBe(false);
  });

  it('ends the active drag mark when the workspace unmounts in the middle of a drag', () => {
    const {container, unmount} = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    fireEvent.pointerDown(gapOf(container, 'left'), {
      pointerId: 1,
      button: 0,
      clientX: 300,
    });
    expect(isColumnDragActive()).toBe(true);
    unmount();
    expect(isColumnDragActive()).toBe(false);
  });

  it('keeps the live keys working after the 슬라이드 size slider is used with the mouse', () => {
    const next = vi
      .spyOn(showState, 'outputNext')
      .mockImplementation(() => undefined);
    showState.openItem('song-morning');
    const {container} = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const tile = container.querySelector<HTMLElement>(
      '[role="option"][tabindex="0"]',
    );
    if (!tile) throw new Error('The selected tile is missing');
    tile.focus();
    const slider = screen.getByRole('slider', {name: '슬라이드 크기'});

    fireEvent.pointerDown(slider, {pointerId: 1, button: 0});
    slider.focus();
    fireEvent.change(slider, {target: {value: '150'}});
    fireEvent.pointerUp(slider, {pointerId: 1});

    expect(document.activeElement).toBe(tile);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      code: 'Space',
      key: ' ',
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blurs the slider after the mouse when nothing had focus, and Tab can still reach it', () => {
    const next = vi
      .spyOn(showState, 'outputNext')
      .mockImplementation(() => undefined);
    render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const slider = screen.getByRole('slider', {name: '슬라이드 크기'});
    fireEvent.pointerDown(slider, {pointerId: 1, button: 0});
    slider.focus();
    fireEvent.pointerUp(slider, {pointerId: 1});
    expect(document.activeElement).not.toBe(slider);
    fireEvent.keyDown(document.body, {code: 'Space', key: ' '});
    expect(next).toHaveBeenCalledTimes(1);
    expect(slider.tabIndex).toBe(0);
  });

  it('keeps room for the scrollbar in the 슬라이드 panel body only', () => {
    render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    const bodyOf = (name: string): string =>
      screen.getByRole('region', {name}).children[1]?.className ?? '';
    expect(bodyOf('슬라이드')).toContain('stableScrollbar');
    expect(bodyOf('예배 순서')).not.toContain('stableScrollbar');
  });

  it('names the slide panel of the 진행 workspace 슬라이드', () => {
    render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    expect(screen.getByRole('region', {name: '슬라이드'})).toBeTruthy();
    expect(screen.getByRole('listbox', {name: '슬라이드'})).toBeTruthy();
    expect(screen.queryByRole('region', {name: '장'})).toBeNull();
  });

  it('shows the preview panel in the 진행 workspace and nowhere else', () => {
    const show = render(
      <Workspace
        id="show"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    expect(show.container.querySelector('[data-screen="main"]')).not.toBeNull();
    show.unmount();
    const prep = render(
      <Workspace
        id="prep"
        sizeClass="normal"
        store={createMemoryColumnWidthStore()}
      />,
    );
    expect(prep.container.querySelector('[data-screen="main"]')).toBeNull();
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
