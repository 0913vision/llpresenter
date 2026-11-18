import {act, render} from '@testing-library/react';
import type {JSX} from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {HeldFrame, type FrameHold} from '@renderer/ui/HeldFrame';

const frames: FrameRequestCallback[] = [];

beforeEach(() => {
  frames.length = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frames.push(callback);
    return frames.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(() => {
    const rect = new DOMRect(0, 0, 10, 10);
    const list: DOMRectList = Object.assign([rect], {item: () => rect});
    return list;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function runFrames(count: number): void {
  for (let turn = 0; turn < count; turn++) {
    act(() => {
      for (const callback of frames.splice(0)) callback(performance.now());
    });
  }
}

function held(): string | null {
  return document.querySelector('[data-held-copy]')?.textContent ?? null;
}

function frame(hold: FrameHold, ready: string | null): JSX.Element {
  return (
    <HeldFrame hold={hold}>
      <div>
        <p>{hold.identity}</p>
        {ready === null ? null : <div data-preview-ready={ready} />}
      </div>
    </HeldFrame>
  );
}

it('shows the previous picture until the new content is drawn', () => {
  const view = render(frame({identity: 'table', settled: true}, null));
  expect(held()).toBeNull();
  view.rerender(frame({identity: 'edit', settled: true}, 'false'));
  expect(held()).toBe('table');
  runFrames(3);
  expect(held()).toBe('table');
  view.rerender(frame({identity: 'edit', settled: true}, 'true'));
  runFrames(1);
  expect(held()).toBe('table');
  runFrames(1);
  expect(held()).toBeNull();
  view.unmount();
});

it('keeps holding while the frame passes through other states', () => {
  const view = render(frame({identity: 'edit:a', settled: true}, 'true'));
  view.rerender(frame({identity: 'edit:b', settled: false}, 'true'));
  runFrames(4);
  expect(held()).toBe('edit:a');
  view.rerender(frame({identity: 'edit:b', settled: true}, 'true'));
  runFrames(2);
  expect(held()).toBeNull();
  view.unmount();
});

it('changes nothing while what the frame shows stays the same', () => {
  const view = render(frame({identity: 'table', settled: true}, 'true'));
  view.rerender(frame({identity: 'table', settled: true}, 'false'));
  expect(held()).toBeNull();
  view.unmount();
});
