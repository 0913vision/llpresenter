import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers, type LiveLayers} from '@shared/live';
import {parseStageLayouts, type StageLayout} from '@shared/schema/stageLayouts';
import {parseTimers} from '@shared/schema/timers';
import type {TimerRuns} from '@shared/schema/timerState';
import {parseLiveState} from '@shared/schema/liveState';
import {
  MAIN,
  overlayUuid,
  STAGE,
  TEXT_STYLE,
} from '../../../main/live/testing/overlays';
import {classes} from './classes';
import type {RenderFrame} from './layer';
import {DEFAULT_LYRIC_STYLE} from './lyricStyle';
import {OutputRenderer} from './outputRenderer';
import type {ScreenAppearance} from './screenLook';
import {
  MAX_REPORTED_STAGE_ERRORS,
  STAGE_TICK_MS,
  StageLayoutView,
  stageClockText,
} from './stageLayout';

const SERMON = overlayUuid(80);
const TIMER_START = 5_000_000;
const WALL = new Date(2026, 9, 26, 9, 5, 0).getTime();
const KINDS = [
  'currentSlide',
  'nextSlide',
  'currentLabel',
  'nextLabel',
  'clock',
  'timer',
  'stageMessage',
] as const;

function layoutOf(elements: readonly object[], id = 81): StageLayout {
  const parsed = parseStageLayouts(
    JSON.stringify({
      format: 'llsettings.stage',
      schemaVersion: 1,
      layouts: [
        {
          id: overlayUuid(id),
          name: '현재와 다음',
          width: 1920,
          height: 1080,
          elements,
        },
      ],
    }),
    'stage-layouts.json',
  );
  if (!parsed.ok) throw new Error(parsed.error.message);
  const [layout] = parsed.value.data.layouts;
  if (layout === undefined) throw new Error('Missing layout');
  return layout;
}

function element(kind: string, index: number, fields: object = {}) {
  return {
    id: overlayUuid(100 + index),
    name: kind,
    kind,
    frame: {x: index * 10, y: 20, w: 400, h: 100},
    text: {...TEXT_STYLE, autoFit: false},
    ...fields,
  };
}

const EVERY_KIND = layoutOf(KINDS.map((kind, index) => element(kind, index)));

function sermonTimers(runs: TimerRuns | undefined, now = TIMER_START) {
  const parsed = parseTimers(
    JSON.stringify({
      format: 'llsettings.timers',
      schemaVersion: 1,
      timers: [{id: SERMON, name: '설교', kind: 'countdown', duration: 60}],
    }),
    'timers.json',
  );
  if (!parsed.ok) throw new Error(parsed.error.message);
  return {
    list: parsed.value.data.timers,
    runs,
    now: () => ({timer: now, wall: WALL}),
  };
}

function runningSermon(): TimerRuns {
  const parsed = parseLiveState({
    version: 0,
    layers: emptyLayers(),
    outputs: {},
    canUndo: false,
    timers: {
      [SERMON]: {state: 'running', since: TIMER_START, countedMs: 0, day: 0},
    },
  });
  if (!parsed.ok || parsed.value.timers === undefined) {
    throw new Error('Invalid run fixture');
  }
  return parsed.value.timers;
}

const LAYERS: LiveLayers = {
  ...emptyLayers(),
  slide: {
    itemId: 'item-1',
    position: 0,
    label: '1절',
    lines: ['첫 줄', '둘째 줄'],
    next: {label: '후렴', lines: ['다음 줄']},
  },
};

function frameOf(fields: Partial<RenderFrame> = {}): RenderFrame {
  return {
    screen: {id: STAGE, kind: 'stage'},
    stageMessage: '후렴 한 번 더',
    timers: sermonTimers(runningSermon()),
    stage: {layout: EVERY_KIND, timerId: sermonId()},
    ...fields,
  };
}

function withoutStage(): RenderFrame {
  const {stage: _stage, ...frame} = frameOf();
  return frame;
}

function sermonId() {
  const [timer] = sermonTimers(undefined).list;
  if (timer === undefined) throw new Error('Missing 타이머');
  return timer.id;
}

function setup() {
  const parent = document.createElement('div');
  const onError = vi.fn();
  const view = new StageLayoutView(parent, onError);
  const canvas = parent.firstElementChild;
  if (!(canvas instanceof HTMLElement)) throw new Error('Missing canvas');
  const texts = () =>
    [...canvas.querySelectorAll(`:scope > * > *`)].map(
      ({textContent}) => textContent,
    );
  return {parent, view, canvas, texts, onError};
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('stageClockText', () => {
  it('reads the 24-hour time with two-digit hours and minutes', () => {
    expect(stageClockText(WALL)).toBe('09:05');
    expect(stageClockText(new Date(2026, 9, 26, 23, 59, 59).getTime())).toBe(
      '23:59',
    );
  });
});

describe('StageLayoutView', () => {
  it('draws every element kind from the live 장, the stage 타이머, and the stage message', () => {
    const {view, texts} = setup();
    view.render(LAYERS, frameOf());
    expect(texts()).toEqual([
      '첫 줄\n둘째 줄',
      '다음 줄',
      '1절',
      '후렴',
      '09:05',
      '1:00',
      '후렴 한 번 더',
    ]);
    view.dispose();
  });

  it('empties next lyrics and next 이름표 after the last 장, and everything on a clear', () => {
    const {view, texts} = setup();
    const {next: _next, ...last} = LAYERS.slide ?? {
      itemId: '',
      position: 0,
      label: null,
      lines: [],
    };
    view.render({...LAYERS, slide: last}, frameOf());
    expect(texts().slice(0, 4)).toEqual(['첫 줄\n둘째 줄', '', '1절', '']);
    view.render(emptyLayers(), frameOf({stageMessage: null}));
    expect(texts()).toEqual(['', '', '', '', '09:05', '1:00', '']);
    view.dispose();
  });

  it('follows the Look switches: lyrics off empties the 장 and 이름표 elements', () => {
    const {view, texts} = setup();
    const look: ScreenAppearance = {
      layers: {slide: false, clock: false, stageMessage: false},
      lyricStyle: DEFAULT_LYRIC_STYLE,
      background: null,
    };
    view.render(LAYERS, frameOf({look}));
    expect(texts()).toEqual(['', '', '', '', '', '1:00', '']);
    view.dispose();
  });

  it('leaves 그림 and 메모 장 elements empty until their sources exist', () => {
    const {view, texts} = setup();
    const layout = layoutOf([
      element('currentSlide', 0, {show: 'image'}),
      element('nextSlide', 1, {show: 'memo'}),
      element('currentSlide', 2, {show: 'text'}),
    ]);
    view.render(LAYERS, frameOf({stage: {layout}}));
    expect(texts()).toEqual(['', '', '첫 줄\n둘째 줄']);
    view.dispose();
  });

  it('frames each element in canvas px and scales the canvas to fit the screen', () => {
    const {parent, view, canvas} = setup();
    vi.spyOn(parent, 'clientWidth', 'get').mockReturnValue(960);
    vi.spyOn(parent, 'clientHeight', 'get').mockReturnValue(720);
    const layout = layoutOf([
      element('clock', 0, {
        frame: {x: 40, y: 60, w: 300, h: 120},
        box: {background: '#102030', opacity: 0.5},
      }),
    ]);
    view.render(LAYERS, frameOf({stage: {layout}}));
    expect(canvas.style).toMatchObject({
      width: '1920px',
      height: '1080px',
      transform: 'translate(-50%, -50%) scale(0.5)',
    });
    const box = canvas.firstElementChild;
    expect(box instanceof HTMLElement && box.style).toMatchObject({
      left: '40px',
      top: '60px',
      width: '300px',
      height: '120px',
      background: 'rgba(16, 32, 48, 0.5)',
    });
    vi.spyOn(parent, 'clientWidth', 'get').mockReturnValue(1920);
    view.rescale();
    expect(canvas.style.transform).toBe(
      'translate(-50%, -50%) scale(0.6666666666666666)',
    );
    view.dispose();
  });

  it('shrinks auto-fit text until it fits its box, and keeps the set size otherwise', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return Number.parseFloat(this.style.fontSize || '0') * 2;
      },
    );
    const {view, canvas} = setup();
    const layout = layoutOf([
      element('currentSlide', 0, {text: {...TEXT_STYLE, autoFit: true}}),
      element('nextSlide', 1),
    ]);
    view.render(LAYERS, frameOf({stage: {layout}}));
    const sizes = [
      ...canvas.querySelectorAll<HTMLElement>(':scope > * > *'),
    ].map(({style}) => style.fontSize);
    expect(sizes).toEqual(['50px', `${TEXT_STYLE.size}px`]);
    view.dispose();
  });

  it('builds the elements once per layout', () => {
    const {view, canvas} = setup();
    view.render(LAYERS, frameOf());
    const first = canvas.firstElementChild;
    view.render(emptyLayers(), frameOf());
    expect(canvas.firstElementChild).toBe(first);
    const other = layoutOf([element('clock', 0)], 82);
    view.render(LAYERS, frameOf({stage: {layout: other}}));
    expect(canvas.firstElementChild).not.toBe(first);
    expect(canvas.childElementCount).toBe(1);
    view.render(LAYERS, withoutStage());
    expect(canvas.hidden).toBe(true);
    expect(canvas.childElementCount).toBe(0);
    view.dispose();
  });

  it('ticks the clock and a running 타이머 once a second, only while one shows', () => {
    const {view, texts} = setup();
    const started = vi.spyOn(globalThis, 'setInterval');
    const stopped = vi.spyOn(globalThis, 'clearInterval');
    let now = TIMER_START;
    const timers = {
      ...sermonTimers(runningSermon()),
      now: () => ({timer: now, wall: WALL}),
    };
    view.render(LAYERS, frameOf({timers}));
    view.render(LAYERS, frameOf({timers}));
    expect(started).toHaveBeenCalledOnce();
    now += STAGE_TICK_MS;
    vi.advanceTimersByTime(STAGE_TICK_MS);
    expect(texts()[5]).toBe('0:59');
    const quiet = layoutOf([element('currentSlide', 0)], 83);
    view.render(LAYERS, frameOf({stage: {layout: quiet}}));
    expect(stopped).toHaveBeenCalledOnce();
    view.render(LAYERS, frameOf({timers}));
    view.dispose();
    expect(stopped).toHaveBeenCalledTimes(2);
  });

  it('keeps the text and logs once when a tick fails', () => {
    const {view, texts, onError} = setup();
    let fail = false;
    const timers = {
      ...sermonTimers(runningSermon()),
      now: () => {
        if (fail) throw new Error('no clock');
        return {timer: TIMER_START, wall: WALL};
      },
    };
    view.render(LAYERS, frameOf({timers}));
    fail = true;
    vi.advanceTimersByTime(STAGE_TICK_MS * 3);
    expect(texts()[4]).toBe('09:05');
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      'could not tick the stage layout',
      new Error('no clock'),
    );
    expect(MAX_REPORTED_STAGE_ERRORS).toBe(32);
    view.dispose();
  });
});

describe('a 무대 화면 with a stage layout', () => {
  it('draws the 장 and the stage message only in the layout', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
    const parent = document.createElement('div');
    const renderer = new OutputRenderer(parent, {
      lyricStyle: DEFAULT_LYRIC_STYLE,
      mediaUrl: id => `https://media.test/${id}`,
      onError: vi.fn(),
    });
    const shown = (kind: string) =>
      parent.querySelector(`[data-layer="${kind}"] .${classes.shown}`)
        ?.textContent ?? null;
    renderer.render(LAYERS, withoutStage());
    expect([shown('lyrics'), shown('stage-message')]).toEqual([
      '첫 줄둘째 줄',
      '후렴 한 번 더',
    ]);
    renderer.render(LAYERS, frameOf());
    expect([shown('lyrics'), shown('stage-message')]).toEqual([null, null]);
    expect(
      parent.querySelector('[data-layer="stage-layout"]')?.textContent,
    ).toContain('후렴 한 번 더');
    renderer.render(LAYERS, {screen: {id: MAIN, kind: 'audience'}});
    expect(shown('lyrics')).toBe('첫 줄둘째 줄');
    renderer.dispose();
    vi.unstubAllGlobals();
  });
});
