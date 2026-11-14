import {act, fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import type {CSSProperties} from 'react';
import {
  useSongBlockWindow,
  type WindowSlideItem,
} from '@renderer/features/songs/editor/useSongBlockWindow';

const rowStyle: CSSProperties & {'--size-control-xs': string} = {
  '--size-control-xs': '22px',
  paddingTop: '14px',
  paddingBottom: '14px',
  borderBottom: '1px solid',
};
function Fixture({
  slides,
  selected,
  mode = 'list',
  scale = 100,
  heights,
  fieldPadding = 0,
}: {
  readonly mode?: 'list' | 'grid';
  readonly scale?: number;
  readonly heights?: ReadonlyArray<number | undefined> | undefined;
  readonly fieldPadding?: number;
  readonly slides: readonly WindowSlideItem[];
  readonly selected: number;
}) {
  const {viewport, total, offsets, columns, indices, setScrollTop} =
    useSongBlockWindow(slides, selected, {
      mode,
      scale,
      ...(heights === undefined ? {} : {heights}),
    });
  return (
    <div
      ref={viewport}
      data-testid="viewport"
      data-columns={columns}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div data-testid="content" style={{height: total}}>
        {indices.map(index => (
          <div
            key={index}
            data-editor-block={index}
            style={{...rowStyle, top: offsets[Math.floor(index / columns)]}}
          >
            <textarea
              aria-label={`Row ${index}`}
              style={{
                lineHeight: '20px',
                padding: `${fieldPadding}px 0`,
                border: 0,
              }}
              defaultValue={slides[index]?.lines.join('\n')}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
function observer() {
  let resize = (): void => undefined;
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = () => callback([], this);
      }
      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    },
  );
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  return {resize: () => resize(), observe, disconnect};
}

describe('song block window measurements', () => {
  it('accounts for field padding for tall lyrics without adding gaps after short rows', () => {
    const measured = observer();
    render(
      <Fixture
        slides={[
          {lines: ['one']},
          {lines: ['one', 'two', 'three']},
          {lines: ['next']},
        ]}
        selected={0}
        fieldPadding={8}
      />,
    );
    act(() => measured.resize());
    expect(
      screen.getByRole('textbox', {name: 'Row 1'}).parentElement?.style.top,
    ).toBe('65px');
    expect(
      screen.getByRole('textbox', {name: 'Row 2'}).parentElement?.style.top,
    ).toBe('170px');
  });
  it('aligns a four-line and a six-line grid cell and preserves scrolling as the row grows', () => {
    const measured = observer();
    const slides = [
      {lines: ['a', 'b', 'c', 'd']},
      {lines: ['a', 'b', 'c', 'd', 'e', 'f']},
      {lines: ['short']},
      {lines: ['short']},
      {lines: ['next row']},
    ];
    const view = render(
      <Fixture
        slides={slides}
        selected={0}
        mode="grid"
        heights={[210, 270, 180, 180, 180]}
      />,
    );
    const viewport = screen.getByTestId('viewport');
    Object.defineProperty(viewport, 'clientHeight', {
      value: 300,
      configurable: true,
    });
    Object.defineProperty(viewport, 'clientWidth', {
      value: 1000,
      configurable: true,
    });
    act(() => measured.resize());
    expect(
      screen.getByRole('textbox', {name: 'Row 0'}).parentElement?.style.top,
    ).toBe('0px');
    expect(
      screen.getByRole('textbox', {name: 'Row 1'}).parentElement?.style.top,
    ).toBe('0px');
    expect(
      screen.getByRole('textbox', {name: 'Row 4'}).parentElement?.style.top,
    ).toBe('270px');
    fireEvent.scroll(viewport, {target: {scrollTop: 42}});
    view.rerender(
      <Fixture
        slides={slides}
        selected={0}
        mode="grid"
        heights={[210, 310, 180, 180, 180]}
      />,
    );
    expect(
      screen.getByRole('textbox', {name: 'Row 4'}).parentElement?.style.top,
    ).toBe('310px');
    expect(viewport.scrollTop).toBe(42);
  });

  it('windows 300 grid slides and reveals the selected cell at either zoom', () => {
    const measured = observer();
    const slides = Array.from({length: 300}, () => ({lines: ['Slide']}));
    const view = render(<Fixture slides={slides} selected={0} mode="grid" />);
    const viewport = screen.getByTestId('viewport');
    Object.defineProperty(viewport, 'clientHeight', {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(viewport, 'clientWidth', {
      value: 1000,
      configurable: true,
    });
    act(() => measured.resize());
    expect(viewport.dataset['columns']).toBe('4');
    expect(screen.getAllByRole('textbox').length).toBeLessThan(40);
    view.rerender(<Fixture slides={slides} selected={120} mode="grid" />);
    expect(viewport.scrollTop).toBeGreaterThan(0);
    expect(screen.getByRole('textbox', {name: 'Row 120'})).toBeDefined();
    fireEvent.scroll(viewport);
    expect(screen.getAllByRole('textbox').length).toBeLessThan(40);
    view.rerender(
      <Fixture slides={slides} selected={120} mode="grid" scale={200} />,
    );
    expect(viewport.dataset['columns']).toBe('2');
    expect(screen.getByRole('textbox', {name: 'Row 120'})).toBeDefined();
  });

  it('uses line counts and token metrics, reveals the final row, and disconnects its one observer', () => {
    const measured = observer();
    const slides: readonly WindowSlideItem[] = [
      {lines: ['Short']},
      {lines: ['Long', 'Second', 'Third']},
      {lines: []},
      ...Array.from({length: 100}, () => ({lines: ['Invented']})),
    ];
    const view = render(<Fixture slides={slides} selected={0} />);
    const viewport = screen.getByTestId('viewport');
    Object.defineProperty(viewport, 'clientHeight', {
      value: 100,
      configurable: true,
    });
    act(() => measured.resize());
    expect(screen.getByTestId('content').style.height).toBe('5291px');
    expect(measured.observe).toHaveBeenCalledExactlyOnceWith(viewport);
    fireEvent.scroll(viewport, {target: {scrollTop: 1211}});
    expect(screen.queryByRole('textbox', {name: 'Row 20'})).toBeNull();
    expect(screen.getByRole('textbox', {name: 'Row 21'})).toBeDefined();
    expect(screen.getByRole('textbox', {name: 'Row 26'})).toBeDefined();
    expect(screen.getAllByRole('textbox').length).toBeLessThanOrEqual(8);
    view.rerender(<Fixture slides={slides} selected={102} />);
    expect(viewport.scrollTop).toBe(5191);
    expect(screen.getByRole('textbox', {name: 'Row 102'})).toBeDefined();
    view.unmount();
    expect(measured.disconnect).toHaveBeenCalledOnce();
  });

  it('recalculates positions when line counts or viewport height change', () => {
    const measured = observer();
    const slides: readonly WindowSlideItem[] = Array.from(
      {length: 100},
      () => ({
        lines: ['Invented'],
      }),
    );
    const view = render(<Fixture slides={slides} selected={1} />);
    const viewport = screen.getByTestId('viewport');
    Object.defineProperty(viewport, 'clientHeight', {
      value: 100,
      configurable: true,
    });
    act(() => measured.resize());
    expect(
      screen.getByRole('textbox', {name: 'Row 1'}).parentElement?.style.top,
    ).toBe('51px');
    const changed = [
      {lines: ['One', 'Two', 'Three', 'Four', 'Five']},
      ...slides.slice(1),
    ];
    view.rerender(<Fixture slides={changed} selected={1} />);
    expect(
      screen.getByRole('textbox', {name: 'Row 1'}).parentElement?.style.top,
    ).toBe('129px');
    expect(screen.getByTestId('content').style.height).toBe('5178px');
    Object.defineProperty(viewport, 'clientHeight', {
      value: 300,
      configurable: true,
    });
    act(() => measured.resize());
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(4);
  });
});
