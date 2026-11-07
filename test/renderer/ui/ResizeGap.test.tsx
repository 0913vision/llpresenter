import {readFileSync} from 'node:fs';
import {fireEvent, render} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ResizeGap} from '@renderer/ui/ResizeGap';
import {
  isCommandDragActive,
  setCommandDragActive,
} from '@renderer/ui/commandDrag';

afterEach(() => setCommandDragActive(false));

describe('ResizeGap', () => {
  it('ends an unmounted column handle session so another handle can begin', () => {
    let dragging = false;
    const end = vi.fn(() => {
      dragging = false;
    });
    const begin = vi.fn(() => {
      if (dragging) return undefined;
      dragging = true;
      return {move: vi.fn(), end};
    });
    const first = render(<ResizeGap axis="column" name="left" begin={begin} />);
    const gap = first.container.firstElementChild;
    if (!(gap instanceof HTMLElement)) throw new Error('Missing gap');
    gap.setPointerCapture = vi.fn();
    fireEvent.pointerDown(gap, {button: 0, pointerId: 1, clientX: 200});
    expect(dragging).toBe(true);
    first.unmount();
    expect(end).toHaveBeenCalledOnce();
    expect(dragging).toBe(false);
    expect(isCommandDragActive()).toBe(false);
    const second = render(
      <ResizeGap axis="column" name="left" begin={begin} />,
    );
    const next = second.container.firstElementChild;
    if (!(next instanceof HTMLElement)) throw new Error('Missing gap');
    next.setPointerCapture = vi.fn();
    fireEvent.pointerDown(next, {button: 0, pointerId: 2, clientX: 200});
    expect(next.setPointerCapture).toHaveBeenCalledWith(2);
    expect(dragging).toBe(true);
    fireEvent.pointerUp(next, {pointerId: 2});
    expect(end).toHaveBeenCalledTimes(2);
    second.unmount();
  });
  it('captures a row drag, uses vertical movement, and ends on capture loss', () => {
    const session = {move: vi.fn(), end: vi.fn()};
    const {container, unmount} = render(
      <ResizeGap axis="row" name="rows" begin={() => session} />,
    );
    const gap = container.firstElementChild;
    if (!(gap instanceof HTMLElement)) throw new Error('Missing gap');
    gap.setPointerCapture = vi.fn();
    fireEvent.pointerDown(gap, {button: 0, pointerId: 1, clientY: 200});
    expect(gap.setPointerCapture).toHaveBeenCalledWith(1);
    fireEvent.pointerMove(gap, {pointerId: 2, clientY: 300});
    expect(session.move).not.toHaveBeenCalled();
    fireEvent.pointerMove(gap, {pointerId: 1, clientX: 800, clientY: 240});
    expect(session.move).toHaveBeenCalledWith(40);
    expect(isCommandDragActive()).toBe(true);
    fireEvent.lostPointerCapture(gap, {pointerId: 1});
    expect(session.end).toHaveBeenCalledOnce();
    expect(isCommandDragActive()).toBe(false);
    unmount();
  });

  it('does not start disabled borders or a second simultaneous drag', () => {
    const begin = vi.fn();
    const {container, rerender} = render(
      <ResizeGap axis="row" name="rows" begin={begin} disabled />,
    );
    const gap = container.firstElementChild;
    if (!(gap instanceof HTMLElement)) throw new Error('Missing gap');
    fireEvent.pointerDown(gap, {button: 0, pointerId: 1});
    expect(begin).not.toHaveBeenCalled();
    rerender(<ResizeGap axis="row" name="rows" begin={begin} />);
    setCommandDragActive(true);
    fireEvent.pointerDown(gap, {button: 0, pointerId: 1});
    expect(begin).not.toHaveBeenCalled();
  });

  it('grabs 8px across every border: the drawn gap plus the same reach on each side', () => {
    const read = (path: string): string => readFileSync(path, 'utf-8');
    const tokens = read('src/renderer/src/styles/tokens.css');
    const css = read('src/renderer/src/ui/ResizeGap.module.css');
    const px = (name: string): number =>
      Number(new RegExp(String.raw`--${name}:\s*(\d+)px`).exec(tokens)?.[1]);
    const grab = px('panel-gap') + 2 * px('space-2');
    expect(grab).toBe(8);
    expect(css).toContain('inset: 0 calc(-1 * var(--space-2))');
    expect(css).toContain('inset: calc(-1 * var(--space-2)) 0');
    expect(css).toMatch(/\.column \{\s*width: var\(--panel-gap\)/);
    expect(css).toMatch(/\.row \{[^}]*height: var\(--panel-gap\)/);
  });
});
