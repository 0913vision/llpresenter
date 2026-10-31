import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {createThemeElementId, createTimerId} from '@core/schema/ids';
import {newThemeElement} from '@core/themes/newElement';
import type {ThemeElement} from '@core/schema/themes';
import {SlideLayerView} from './slideLayer';
import {DEFAULT_LYRIC_STYLE} from '@core/looks/lyricStyle';
import {classes} from './classes';
import {stageClockText} from './stageLayout';
import {fillTimerTokens} from './timerTokens';
import {ThemePicture} from './ThemePicture';

vi.mock('./stageLayout', () => ({
  STAGE_TICK_MS: 1000,
  stageClockText: vi.fn((wall: number, format: string) => `${wall}:${format}`),
}));
vi.mock('./timerTokens', () => ({fillTimerTokens: vi.fn(() => 'Bound timer')}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function element(kind: ThemeElement['kind'], index: number): ThemeElement {
  const value = newThemeElement({
    kind,
    id: createThemeElementId(
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    ),
  });
  if (value === undefined) throw new Error('Missing picture fixture');
  return value;
}

it('keeps the fill opacity separate from its fitted text', () => {
  const source = element('currentText', 1);
  if (source.kind !== 'currentText') throw new Error('Expected current text');
  const value = {
    ...source,
    frame: {x: 0, y: 0, w: 800, h: 400},
    text: {...source.text, lineHeight: 1, maxLines: 2, align: 'right' as const},
    box: {on: true, fill: '#112233', opacity: 50, radius: 8},
  };
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(100);
  const view = render(
    <ThemePicture
      elements={[value]}
      background="#000000"
      samples={{currentText: 'Invented preview'}}
    />,
  );
  const text = screen.getByText('Invented preview');
  expect(text.style.textAlign).toBe('right');
  expect(text.style.fontSize).toBe(`${source.text.size}px`);
  const fill = view.container.querySelector<HTMLElement>('[style*="opacity"]');
  expect(fill?.style.opacity).toBe('0.5');
  expect(text.style.opacity).toBe('');
});

it.each(['currentText', 'nextText'] as const)(
  'fits a two-line %s sample to one configured line with the real output fitter',
  kind => {
    const source = element(kind, 3);
    if (source.kind !== 'currentText' && source.kind !== 'nextText') {
      throw new Error('Expected lyric text');
    }
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return Number.parseFloat(this.style.fontSize) * 2;
      },
    );
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    const view = render(
      <ThemePicture
        elements={[
          {
            ...source,
            frame: {x: 0, y: 0, w: 800, h: 400},
            text: {...source.text, size: 100, lineHeight: 1, maxLines: 1},
          },
        ]}
        background="#000000"
        samples={{[kind]: 'Invented first line\nInvented second line'}}
      />,
    );
    const preview = screen.getByText(/Invented first line/);
    expect(preview.style.fontSize).toBe('50px');
    const parent = document.createElement('div');
    const output = new SlideLayerView(parent, {
      ...DEFAULT_LYRIC_STYLE,
      size: 100,
      lineHeight: 1,
      maxLines: 1,
      margin: 0,
    });
    output.show({
      itemId: 'invented',
      position: 0,
      label: null,
      lines: ['Invented first line', 'Invented second line'],
    });
    expect(
      parent.querySelector<HTMLElement>(`.${classes.shown} .${classes.block}`)
        ?.style.fontSize,
    ).toBe(preview.style.fontSize);
    output.dispose();
    view.unmount();
  },
);

it('binds clock formatting and timer identity through the shared renderers and releases every tick', () => {
  vi.useFakeTimers();
  const clock = element('clock', 1);
  const timer = element('timer', 2);
  if (clock.kind !== 'clock' || timer.kind !== 'timer') {
    throw new Error('Expected timed text');
  }
  const timerId = createTimerId('00000000-0000-4000-8000-000000000100');
  let wall = 42;
  const timers = {list: [], runs: undefined, now: () => ({wall, timer: 7})};
  const view = render(
    <ThemePicture
      elements={[
        {...clock, clockFormat: '12h'},
        {...timer, timerId},
      ]}
      background="#000000"
      samples={{}}
      timers={timers}
    />,
  );
  expect(stageClockText).toHaveBeenLastCalledWith(42, '12h');
  expect(fillTimerTokens).toHaveBeenLastCalledWith(
    `{timer:${timerId}}`,
    timers,
    {wall: 42, timer: 7},
  );
  expect(vi.getTimerCount()).toBe(2);
  wall = 43;
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(stageClockText).toHaveBeenLastCalledWith(43, '12h');
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
