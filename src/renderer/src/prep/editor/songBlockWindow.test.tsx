import {act, fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import type {CSSProperties} from 'react';
import type {Slide} from '@core/schema/song';
import {useSongBlockWindow} from './useSongBlockWindow';

const rowStyle: CSSProperties & {'--size-control-xs': string} = {
  '--size-control-xs': '22px',
  paddingTop: '14px',
  paddingBottom: '14px',
  borderBottom: '1px solid',
};
function Fixture({
  slides,
  selected,
}: {
  readonly slides: readonly Slide[];
  readonly selected: number;
}) {
  const {viewport, total, offsets, indices, setScrollTop} = useSongBlockWindow(
    slides,
    selected,
    undefined,
  );
  return (
    <div
      ref={viewport}
      data-testid="viewport"
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div data-testid="content" style={{height: total}}>
        {indices.map(index => (
          <div
            key={index}
            data-editor-block={index}
            style={{...rowStyle, top: offsets[index]}}
          >
            <textarea
              aria-label={`Row ${index}`}
              style={{lineHeight: '20px'}}
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
  it('uses line counts and token metrics, reveals the final row, and disconnects its one observer', () => {
    const measured = observer();
    const slides: readonly Slide[] = [
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
    const slides: readonly Slide[] = Array.from({length: 100}, () => ({
      lines: ['Invented'],
    }));
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
