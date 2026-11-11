import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {
  createThemeElementId,
  createTimerId,
  createThemeId,
  createScreenId,
} from '@core/schema/ids';
import {newThemeElement} from '@core/themes/newElement';
import type {ThemeElement} from '@core/schema/themes';
import {SlideLayerView} from '@renderer/rendering/slideLayer';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {classes} from '@renderer/rendering/classes';
import {stageClockText} from '@renderer/rendering/stageClock';
import {fillTimerTokens} from '@renderer/rendering/timerTokens';
import {ThemePicture} from '@renderer/rendering/ThemePicture';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import bulletStyles from '@renderer/rendering/bulletText.module.css';
import {ThemeCompositionView} from '@renderer/rendering/themeComposition';
import {bibleMeasure} from '@renderer/rendering/bibleMeasure';
import {emptyLayers, type SlideLayer} from '@core/live/state';
import {mediaUrl} from '@contracts/ipc/mediaUrls';

vi.mock('@renderer/rendering/stageClock', () => ({
  STAGE_TICK_MS: 1000,
  stageClockText: vi.fn((wall: number, format: string) => `${wall}:${format}`),
}));
vi.mock('@renderer/rendering/timerTokens', () => ({
  fillTimerTokens: vi.fn(() => 'Bound timer'),
}));
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

it('reuses a thumbnail fit on remount and refits changed text, frame, and style', () => {
  const source = element('currentText', 991);
  if (source.kind !== 'currentText') throw Error('Expected text');
  const width = vi
    .spyOn(Element.prototype, 'scrollWidth', 'get')
    .mockReturnValue(10);
  const show = (value = source, text = 'Remounted thumbnail fit') =>
    render(
      <ThemePicture
        elements={[value]}
        background="#000000"
        samples={{currentText: text}}
      />,
    );
  show().unmount();
  expect(width).toHaveBeenCalledTimes(1);
  show(structuredClone(source)).unmount();
  expect(width).toHaveBeenCalledTimes(1);
  show(source, 'Changed thumbnail fit').unmount();
  show({...source, frame: {...source.frame, w: source.frame.w - 1}}).unmount();
  show({
    ...source,
    text: {...source.text, weight: source.text.weight === 400 ? 800 : 400},
  }).unmount();
  expect(width).toHaveBeenCalledTimes(4);
});

it.each([undefined, 'disc'] as const)(
  'uses %s hanging paragraph markup in thumbnails, including measured text and empty lines',
  bulletStyle => {
    const source = element('currentText', 1);
    if (source.kind !== 'currentText') throw Error('Expected text');
    const value = {
      ...source,
      text: {
        ...source.text,
        bullets: true,
        ...(bulletStyle === undefined ? {} : {bulletStyle}),
      },
    };
    const view = render(
      <ThemePicture
        elements={[value]}
        background="#000000"
        samples={{currentText: 'One\n\nTwo'}}
      />,
    );
    expect(
      view.container.querySelectorAll(`.${bulletStyles.paragraph}`),
    ).toHaveLength(3);
    expect(
      view.container.querySelectorAll(`.${bulletStyles.marker}`),
    ).toHaveLength(2);
    const paragraph = view.container.querySelector(
      `.${bulletStyles.paragraph}`,
    );
    expect(
      paragraph?.parentElement?.style.getPropertyValue('--bullet-indent'),
    ).toBe(`${(bulletStyle === 'disc' ? 107 : 90) / 86}em`);
    view.rerender(
      <ThemePicture
        elements={[value]}
        background="#000000"
        samples={{currentText: ''}}
        measuredText={{lines: ['One', 'Two'], continued: false}}
      />,
    );
    expect(
      view.container.querySelectorAll(`.${bulletStyles.paragraph}`),
    ).toHaveLength(1);
    expect(
      view.container.querySelectorAll(`.${bulletStyles.marker}`),
    ).toHaveLength(1);
    expect(
      view.container.querySelectorAll(`.${bulletStyles.continuation}`),
    ).toHaveLength(1);
  },
);

it.each(['currentText', 'nextText'] as const)(
  'keeps one wrapped verse paragraph through measurement, %s output and thumbnails, including its next part',
  kind => {
    const source = element('currentText', 1);
    if (source.kind !== 'currentText') throw Error('Expected current text');
    const value = {
      ...source,
      frame: {x: 0, y: 0, w: 220, h: 315},
      text: {
        ...source.text,
        size: 86,
        lineHeight: 105 / 86,
        maxLines: 5,
        bullets: true,
      },
    };
    const measured = bibleMeasure(value, {
      font: '',
      measureText: text => ({width: text.length * 10}),
    });
    const result = measured.measure('Alpha beta gamma delta', {
      ...measured.spec,
      marker: '',
      markerSize: 64,
    });
    expect(result.lines).toEqual(['Alpha beta', 'gamma delta']);
    expect(measured.spec.maxLines).toBe(3);
    const layout = {mode: {kind: 'own' as const}, elements: [{...value, kind}]};
    const item = {
      id: 'verse',
      kind: 'bible' as const,
      source: 'external' as const,
    };
    const screen = {
      id: createScreenId('00000000-0000-4000-8000-000000000001'),
      kind: 'audience' as const,
    };
    const frame = {
      screen,
      transitions: false,
      theme: {
        layout,
        item,
        sourceScreenId: screen.id,
        emptyColor: '#000000',
        themeId: createThemeId('00000000-0000-4000-8000-000000000102'),
        revision: 0,
        missing: [],
      },
    };
    const root = document.createElement('div');
    const output = new ThemeCompositionView(root, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl,
      onError: vi.fn(),
    });
    const next = {
      label: null,
      biblePart: kind === 'nextText' ? 1 : 2,
      lines: kind === 'nextText' ? result.lines : ['Other verse'],
    };
    const slide: SlideLayer = {
      itemId: item.id,
      position: 0,
      label: null,
      biblePart: kind === 'currentText' ? 1 : 2,
      lines: kind === 'currentText' ? result.lines : ['Other verse'],
      next,
    };
    const preview = render(
      <SlidePicture slide={slide} layout={layout} item={item} />,
    );
    output.render({...emptyLayers(), slide}, frame);
    const shown = () =>
      root.querySelector(
        `[data-kind="${kind}"] .${classes.shown} .${classes.block}`,
      );
    for (const block of [shown(), preview.container]) {
      expect(block?.querySelectorAll(`.${bulletStyles.marker}`)).toHaveLength(
        1,
      );
      expect(
        block?.querySelectorAll(`.${bulletStyles.paragraph}`),
      ).toHaveLength(1);
      expect(
        block?.querySelectorAll(`.${bulletStyles.continuation}`),
      ).toHaveLength(1);
    }
    const continued =
      kind === 'currentText'
        ? {...slide, biblePart: 2}
        : {...slide, next: {...next, biblePart: 2}};
    output.render({...emptyLayers(), slide: continued}, frame);
    preview.rerender(
      <SlidePicture slide={continued} layout={layout} item={item} />,
    );
    for (const block of [shown(), preview.container]) {
      expect(block?.querySelectorAll(`.${bulletStyles.marker}`)).toHaveLength(
        0,
      );
      expect(
        block?.querySelectorAll(`.${bulletStyles.paragraph}`),
      ).toHaveLength(0);
      expect(
        block?.querySelectorAll(`.${bulletStyles.continuation}`),
      ).toHaveLength(2);
    }
    output.dispose();
  },
);

it('resolves an item-range reference in a slide thumbnail just as output does', () => {
  const reference = element('reference', 8);
  if (reference.kind !== 'reference') throw Error('Expected reference');
  render(
    <SlidePicture
      slide={{
        itemId: 'bible',
        position: 1,
        label: null,
        lines: ['Invented verse'],
        reference: 'Book 11:30',
      }}
      layout={{mode: {kind: 'own'}, elements: [{...reference, source: 'item'}]}}
      item={{
        id: 'bible',
        kind: 'bible',
        source: 'external',
        title: 'Book 11:29~30',
      }}
    />,
  );
  expect(screen.getByText('Book 11:29~30')).toBeTruthy();
  expect(screen.queryByText('Book 11:30')).toBeNull();
});

it('keeps measured Bible rows at the theme size and frame instead of fitting or rewrapping them', () => {
  const source = element('currentText', 1);
  if (source.kind !== 'currentText') throw Error('Expected current text');
  const frame = {x: 115.2, y: 100, w: 1689.6, h: 600};
  const value = {...source, frame, text: {...source.text, size: 84}};
  const lines = [
    '16 성경이 아닌 창작 점검 문장입니다. 3장 16절',
    '위치를 확인합니다. (계속)',
  ];
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(2000);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
  const view = render(
    <SlidePicture
      slide={{
        itemId: 'bible',
        position: 0,
        label: '3:16',
        biblePart: 1,
        continued: true,
        lines,
      }}
      layout={{mode: {kind: 'own'}, elements: [value]}}
    />,
  );
  const first = screen.getByText(lines[0] ?? '');
  const block = first.parentElement;
  expect(block?.style.fontSize).toBe('84px');
  expect(block?.children).toHaveLength(2);
  expect(Array.from(block?.children ?? []).map(row => row.textContent)).toEqual(
    lines,
  );
  expect(screen.getByText('(계속)').style.fontSize).toBe('72px');
  const box = block?.parentElement?.parentElement;
  expect(box?.style.left).toBe('115.2px');
  expect(box?.style.width).toBe('1689.6px');
  view.rerender(
    <SlidePicture
      slide={{
        itemId: 'bible',
        position: 1,
        label: '3:16',
        biblePart: 2,
        lines: ['Final measured line'],
      }}
      layout={{mode: {kind: 'own'}, elements: [value]}}
    />,
  );
  expect(
    screen.getByText('Final measured line').parentElement?.children,
  ).toHaveLength(1);
  expect(screen.queryByText('(계속)')).toBeNull();
});

it('keeps the fill opacity separate from its fitted text', () => {
  const source = element('currentText', 1);
  if (source.kind !== 'currentText') throw new Error('Expected current text');
  const value = {
    ...source,
    frame: {x: 0, y: 0, w: 800, h: 400},
    text: {
      ...source.text,
      lineHeight: 1,
      maxLines: 2,
      tracking: -3,
      align: 'right' as const,
    },
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
  expect(text.style.letterSpacing).toBe('-3px');
  expect(text.style.fontSize).toBe(`${source.text.size}px`);
  const fill = view.container.querySelector<HTMLElement>('[style*="opacity"]');
  expect(fill?.style.opacity).toBe('0.5');
  expect(text.style.opacity).toBe('');
});

it.each(['currentText', 'nextText'] as const)(
  'keeps a two-line %s at theme size while it fits the actual frame',
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
    expect(preview.style.fontSize).toBe('100px');
    const parent = document.createElement('div');
    const output = new SlideLayerView(parent, {
      ...DEFAULT_TEXT_STYLE,
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
  expect(stageClockText).toHaveBeenLastCalledWith(42, '12h', undefined);
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
  expect(stageClockText).toHaveBeenLastCalledWith(43, '12h', undefined);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
