import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {CLICK_FOCUS_SELECTOR} from '@renderer/ui/clickFocus';
import {useQuickDrag} from './useQuickDrag';
import {quickId} from './quickTesting';

afterEach(cleanup);
const pointer = {pointerId: 1, button: 0, clientX: 10};

function setup() {
  let lastY = 15;
  const moved = vi.fn();
  const activated = vi.fn();
  function List({
    enabled = true,
    revision = 1,
  }: {
    enabled?: boolean;
    revision?: number;
  }) {
    const drag = useQuickDrag({enabled, revision, onMove: moved});
    return (
      <div {...drag.listProps}>
        <output aria-label="삽입 위치">
          {drag.before === undefined ? '없음' : (drag.before ?? '끝')}
        </output>
        {[1, 2, 3].map(id => (
          <div key={id} data-quick-id={quickId(id)}>
            <button
              onClick={() => {
                activated(id);
              }}
            >{`항목 ${id}`}</button>
          </div>
        ))}
      </div>
    );
  }
  const view = render(<List />);
  const rows = screen.getAllByRole('button');
  rows.forEach((button, index) => {
    if (button.parentElement) {
      vi.spyOn(button.parentElement, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, index * 30, 200, 30),
      );
    }
  });
  const row = (index: number): HTMLElement => {
    const element = rows[index];
    if (!element) throw new Error('Missing drag row');
    return element;
  };
  return {
    view,
    moved,
    activated,
    row,
    start: (index = 0) => {
      lastY = index * 30 + 15;
      fireEvent.pointerDown(row(index), {...pointer, clientY: lastY});
    },
    move: (y: number) => {
      lastY = y;
      fireEvent.pointerMove(window, {...pointer, clientY: y});
    },
    up: () => fireEvent.pointerUp(window, {...pointer, clientY: lastY}),
    marker: () => screen.getByRole('status', {name: '삽입 위치'}).textContent,
    change: (enabled: boolean, revision: number) =>
      view.rerender(<List enabled={enabled} revision={revision} />),
  };
}

describe('quick pointer reorder', () => {
  it('cancels before a batched release without running or moving the row', () => {
    const drag = setup();
    drag.start();
    act(() => {
      drag.move(100);
      fireEvent.keyDown(window, {key: 'Escape'});
      drag.up();
      fireEvent.click(drag.row(0), {detail: 1});
    });
    expect(drag.moved).not.toHaveBeenCalled();
    expect(drag.activated).not.toHaveBeenCalled();
    expect(drag.marker()).toBe('없음');
  });
  it('handles a move, release and ending click before React commits the drag frame', () => {
    const drag = setup();
    drag.start();
    act(() => {
      drag.move(100);
      drag.up();
      fireEvent.click(drag.row(0), {detail: 1});
    });
    expect(drag.moved).toHaveBeenCalledExactlyOnceWith(quickId(1), null);
    expect(drag.activated).not.toHaveBeenCalled();
  });
  it('keeps ordinary clicks at or below the 4px threshold', () => {
    const drag = setup();
    drag.start();
    fireEvent.pointerMove(window, {...pointer, clientX: 14, clientY: 15});
    expect(drag.marker()).toBe('없음');
    drag.up();
    fireEvent.click(drag.row(0), {detail: 1});
    expect(drag.activated).toHaveBeenCalledOnce();
    expect(drag.moved).not.toHaveBeenCalled();
    expect(drag.row(0).closest(CLICK_FOCUS_SELECTOR)).toBeNull();
  });
  it.each([
    {from: 0, y: 100, before: null},
    {from: 2, y: 0, before: quickId(1)},
    {from: 0, y: 47, before: quickId(3)},
  ])(
    'moves from $from before $before and suppresses only the ending pointer click',
    ({from, y, before}) => {
      const drag = setup();
      drag.start(from);
      drag.move(y);
      expect(drag.marker()).toBe(before ?? '끝');
      drag.up();
      expect(drag.moved).toHaveBeenCalledExactlyOnceWith(
        quickId(from + 1),
        before,
      );
      fireEvent.click(drag.row(from), {detail: 1});
      expect(drag.activated).not.toHaveBeenCalled();
      fireEvent.click(drag.row(from), {detail: 0});
      expect(drag.activated).toHaveBeenCalledOnce();
      drag.start(from);
      drag.up();
      fireEvent.click(drag.row(from), {detail: 1});
      expect(drag.activated).toHaveBeenCalledTimes(2);
    },
  );
  it.each([0, 20])(
    'keeps the original order when released in its own gap at %s',
    y => {
      const drag = setup();
      drag.start();
      drag.move(y);
      drag.up();
      fireEvent.click(drag.row(0), {detail: 1});
      expect(drag.moved).not.toHaveBeenCalled();
      expect(drag.activated).not.toHaveBeenCalled();
    },
  );
  it.each(['escape', 'cancel', 'blur'])(
    'cancels on %s and releases tracking',
    kind => {
      const drag = setup();
      drag.start();
      drag.move(100);
      if (kind === 'escape') fireEvent.keyDown(window, {key: 'Escape'});
      if (kind === 'cancel') fireEvent.pointerCancel(window, pointer);
      if (kind === 'blur') fireEvent.blur(window);
      expect(drag.marker()).toBe('없음');
      drag.up();
      fireEvent.click(drag.row(0), {detail: 1});
      expect(drag.moved).not.toHaveBeenCalled();
      expect(drag.activated).not.toHaveBeenCalled();
    },
  );
  it.each(['revision', 'disabled', 'unmount'])(
    'drops tracking after %s',
    kind => {
      const drag = setup();
      drag.start();
      drag.move(100);
      if (kind === 'revision') drag.change(true, 2);
      if (kind === 'disabled') {
        drag.change(false, 1);
        drag.change(true, 1);
      }
      if (kind === 'unmount') drag.view.unmount();
      drag.up();
      fireEvent.click(drag.row(0), {detail: 1});
      expect(drag.moved).not.toHaveBeenCalled();
      expect(drag.activated).not.toHaveBeenCalled();
    },
  );
  it('ignores secondary buttons and events from another pointer', () => {
    const drag = setup();
    fireEvent.pointerDown(drag.row(0), {...pointer, button: 2, clientY: 15});
    drag.move(100);
    drag.up();
    expect(drag.moved).not.toHaveBeenCalled();
    drag.start();
    fireEvent.pointerMove(window, {...pointer, pointerId: 2, clientY: 100});
    fireEvent.pointerUp(window, {...pointer, pointerId: 2});
    expect(drag.marker()).toBe('없음');
    drag.move(100);
    drag.up();
    expect(drag.moved).toHaveBeenCalledExactlyOnceWith(quickId(1), null);
  });
});
