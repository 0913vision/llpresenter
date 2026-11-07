import {act, cleanup, render, screen} from '@testing-library/react';
import {useRef, type JSX} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {usePreviewRoom} from '@renderer/ui/usePreviewRoom';

const TOKENS: Readonly<Record<string, number>> = {
  '--size-panel-header': 36,
  '--panel-inset': 8,
  '--size-control-md': 30,
  '--size-control-sm': 24,
  '--space-12': 12,
  '--space-8': 8,
  '--size-preview-small-max': 160,
};
/**
 * Width 456: the large picture needs 456 * 9 / 16 + 30 = 286.5, two tiles of
 * 160 wide need 12 + 90 + 24, and the header and the inset add 36 + 16, so the
 * tile row needs 464.5 px in all.
 */
const observers: Array<() => void> = [];

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {
        observers.push(() => this.callback());
      }
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    },
  );
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const token = /var\((--[a-z0-9-]+)\)/.exec(
        this instanceof HTMLElement ? this.style.width : '',
      )?.[1];
      const height = Number(this.getAttribute('data-h') ?? 0);
      return {
        width: token === undefined ? 0 : (TOKENS[token] ?? 0),
        height,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    function (this: HTMLElement) {
      return Number(this.getAttribute('data-cw') ?? 0);
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return Number(this.getAttribute('data-ch') ?? 0);
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const noExtra = (): number => 0;

function Anchor(): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const room = usePreviewRoom(ref, {tiles: 2, extra: noExtra});
  return (
    <div ref={ref} data-cw="472">
      {room ? 'tiles' : 'picker'}
    </div>
  );
}

describe('usePreviewRoom', () => {
  it.each([
    [700, 'picker'],
    [760, 'tiles'],
  ])(
    'gives a workspace panel what its column leaves after its neighbors: %i px',
    (columnHeight, expected) => {
      render(
        <div data-ch={columnHeight}>
          <div data-resize-panel="a" data-h="100">
            <Anchor />
          </div>
          <div data-resize-panel="" data-resize-fixed data-h="52" />
          <div
            data-resize-panel="b"
            data-h="240"
            style={{minHeight: '240px'}}
          />
        </div>,
      );
      expect(screen.getByText(expected)).toBeDefined();
    },
  );

  it('counts the height a splitter gave a neighbor as it is, not its minimum', () => {
    render(
      <div data-ch="760">
        <div data-resize-panel="a">
          <Anchor />
        </div>
        <div
          data-resize-panel="b"
          data-h="300"
          style={{minHeight: '240px', height: '300px'}}
        />
      </div>,
    );
    expect(screen.getByText('picker')).toBeDefined();
  });

  it.each([
    [500, 'tiles'],
    [400, 'picker'],
  ])(
    'takes the height a splitter gave the panel as it is: %i px',
    (height, expected) => {
      render(
        <div data-ch="2000">
          <div
            data-resize-panel="a"
            data-h={height}
            style={{height: `${height}px`}}
          >
            <Anchor />
          </div>
        </div>,
      );
      expect(screen.getByText(expected)).toBeDefined();
    },
  );

  it.each([
    [480, 'tiles'],
    [300, 'picker'],
  ])(
    'uses the height of an ordinary panel in an editor window: %i px',
    (height, expected) => {
      render(
        <section data-h={height}>
          <Anchor />
        </section>,
      );
      expect(screen.getByText(expected)).toBeDefined();
    },
  );

  it('follows a resize in the same render', () => {
    render(
      <section data-h="300">
        <Anchor />
      </section>,
    );
    expect(screen.getByText('picker')).toBeDefined();
    document.querySelector('section')?.setAttribute('data-h', '480');
    act(() => {
      for (const notify of observers) notify();
    });
    expect(screen.getByText('tiles')).toBeDefined();
  });
});
