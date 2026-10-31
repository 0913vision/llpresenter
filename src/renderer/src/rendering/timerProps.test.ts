import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveLayers} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import {parseTimers, type Timer} from '@core/schema/timers';
import type {TimerRuns} from '@core/schema/timerState';
import type {TimerNow} from '@core/timers/timerClock';
import {MAIN, overlayUuid, PROP, TEXT_STYLE} from '@core/testing/overlays';
import {classes} from './classes';
import {DEFAULT_LYRIC_STYLE} from '@core/looks/lyricStyle';
import {OutputRenderer} from './outputRenderer';
import {MAX_REPORTED_TICK_ERRORS} from './layers/props';
import {OverlayTextView} from './overlayText';

const SERMON = overlayUuid(95);
const GONE = overlayUuid(96);
const PLAIN = overlayUuid(97);
const TIMER_START = 5_000_000;
const WALL_START = new Date(2026, 9, 26, 10, 0, 0).getTime();
const screen = {id: MAIN, kind: 'audience'} as const;

let clock: TimerNow = {timer: TIMER_START, wall: WALL_START};
let clockError: Error | null = null;

function readClock(): TimerNow {
  if (clockError !== null) throw clockError;
  return clock;
}

function advance(ms: number): void {
  clock = {timer: clock.timer + ms, wall: clock.wall + ms};
  vi.advanceTimersByTime(ms);
}

function sermonTimer(): readonly Timer[] {
  const parsed = parseTimers(
    JSON.stringify({
      format: 'llsettings.timers',
      schemaVersion: 1,
      timers: [{id: SERMON, name: '설교', kind: 'countdown', duration: 60}],
    }),
    'timers.json',
  );
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value.data.timers;
}

function stateWith(
  text: string,
  runs: object,
  {
    style = TEXT_STYLE,
    others = [],
  }: {readonly style?: object; readonly others?: readonly object[]} = {},
) {
  const parsed = parseLiveState({
    ...emptyLiveState(),
    timers: runs,
    layers: {
      ...emptyLiveState().layers,
      prop: {
        propId: PROP,
        items: [
          {
            propId: PROP,
            content: {kind: 'text', text, style},
            targets: [MAIN],
          },
          ...others,
        ],
      },
    },
  });
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
}

const running = {
  [SERMON]: {
    state: 'running',
    since: TIMER_START,
    countedMs: 0,
    day: WALL_START,
  },
};
const paused = {
  [SERMON]: {
    state: 'paused',
    at: TIMER_START,
    countedMs: 0,
    day: WALL_START,
    wallAt: WALL_START,
  },
};

function setup() {
  const parent = document.createElement('div');
  const onError = vi.fn();
  const renderer = new OutputRenderer(parent, {
    lyricStyle: DEFAULT_LYRIC_STYLE,
    mediaUrl: id => `https://media.test/${id}`,
    onError,
  });
  const list = sermonTimer();
  const render = (layers: LiveLayers, runs: TimerRuns | undefined) =>
    renderer.render(layers, {
      screen,
      timers: {list, runs, now: readClock},
    });
  const shown = () =>
    parent.querySelector<HTMLElement>(
      `[data-layer="prop"] .${classes.page}.${classes.shown}`,
    );
  return {renderer, render, shown, parent, onError};
}

beforeEach(() => {
  vi.useFakeTimers();
  clock = {timer: TIMER_START, wall: WALL_START};
  clockError = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
});

describe('타이머 tokens in 소품 text', () => {
  it('fills a token and ticks it in place once a second', () => {
    const {renderer, render, shown} = setup();
    const state = stateWith(`설교 {timer:${SERMON}}`, running);
    render(state.layers, state.timers);
    const page = shown();
    expect(page?.textContent).toBe('설교 1:00');
    advance(1000);
    expect(shown()).toBe(page);
    expect(page?.textContent).toBe('설교 0:59');
    advance(30_000);
    expect(page?.textContent).toBe('설교 0:29');
    renderer.dispose();
  });

  it('keeps each text 소품 style while the ticker redraws them', () => {
    const {renderer, render, parent} = setup();
    const custom = {...TEXT_STYLE, color: '#FFD400', align: 'left', margin: 3};
    const plain = {...TEXT_STYLE, color: '#00C2FF'};
    const state = stateWith(`설교 {timer:${SERMON}}`, running, {
      style: custom,
      others: [
        {
          propId: PLAIN,
          content: {kind: 'text', text: '헌금', style: plain},
          targets: [MAIN],
        },
      ],
    });
    render(state.layers, state.timers);
    const blocks = () =>
      [
        ...parent.querySelectorAll<HTMLElement>(
          `[data-layer="prop"] .${classes.page}.${classes.shown} .${classes.block}`,
        ),
      ].map(({style, textContent}) => [textContent, style.color]);
    const before = blocks();
    advance(1000);
    expect(blocks()).toEqual([
      ['설교 0:59', before[0]?.[1]],
      ['헌금', before[1]?.[1]],
    ]);
    expect(before.map(([, color]) => color)).toEqual([
      'rgb(255, 212, 0)',
      'rgb(0, 194, 255)',
    ]);
    renderer.dispose();
  });

  it('keeps the last text and logs once when a tick fails', () => {
    const {renderer, render, shown, onError} = setup();
    const state = stateWith(`설교 {timer:${SERMON}}`, running);
    render(state.layers, state.timers);
    const page = shown();
    clockError = new Error('no clock');
    vi.advanceTimersByTime(3000);
    expect(page?.textContent).toBe('설교 1:00');
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      'could not tick a 타이머 in the prop layer',
      new Error('no clock'),
    );
    renderer.dispose();
  });

  it('keeps the other 소품 ticking past a failing one, and stops logging at the cap', () => {
    const {renderer, render, parent, onError} = setup();
    const original = OverlayTextView.prototype.replace;
    let failures = 0;
    vi.spyOn(OverlayTextView.prototype, 'replace').mockImplementation(function (
      this: OverlayTextView,
      text,
      style,
    ) {
      if (text.startsWith('설교')) {
        failures += 1;
        throw new Error(`failure ${failures}`);
      }
      original.call(this, text, style);
    });
    const state = stateWith(`설교 {timer:${SERMON}}`, running, {
      others: [
        {
          propId: PLAIN,
          content: {
            kind: 'text',
            text: `남은 {timer:${SERMON}}`,
            style: TEXT_STYLE,
          },
          targets: [MAIN],
        },
      ],
    });
    render(state.layers, state.timers);
    for (let second = 0; second < MAX_REPORTED_TICK_ERRORS + 8; second += 1) {
      advance(1000);
    }
    const texts = [
      ...parent.querySelectorAll(
        `[data-layer="prop"] .${classes.page}.${classes.shown}`,
      ),
    ].map(({textContent}) => textContent);
    expect(texts).toEqual(['설교 1:00', '남은 0:20']);
    expect(onError).toHaveBeenCalledTimes(MAX_REPORTED_TICK_ERRORS);
    renderer.dispose();
  });

  it('ticks only the 소품 that show a running 타이머', () => {
    const {renderer, render} = setup();
    const replace = vi.spyOn(OverlayTextView.prototype, 'replace');
    const state = stateWith(`설교 {timer:${SERMON}}`, running, {
      others: [
        {
          propId: PLAIN,
          content: {kind: 'text', text: '헌금', style: TEXT_STYLE},
          targets: [MAIN],
        },
      ],
    });
    render(state.layers, state.timers);
    replace.mockClear();
    advance(1000);
    advance(1000);
    expect(replace.mock.calls.map(([text]) => text)).toEqual([
      '설교 0:59',
      '설교 0:58',
    ]);
    renderer.dispose();
  });

  it('redraws a changed value in place when the live state changes', () => {
    const {renderer, render, shown} = setup();
    const state = stateWith(`설교 {timer:${SERMON}}`, running);
    render(state.layers, state.timers);
    const page = shown();
    clock = {timer: clock.timer + 2000, wall: clock.wall + 2000};
    render(state.layers, state.timers);
    expect(shown()).toBe(page);
    expect(page?.textContent).toBe('설교 0:58');
    renderer.dispose();
  });

  it('stops the ticker when the ticking 소품 comes down', () => {
    const {renderer, render} = setup();
    const stopped = vi.spyOn(globalThis, 'clearInterval');
    const state = stateWith(`{timer:${SERMON}}`, running);
    render(state.layers, state.timers);
    render({...state.layers, prop: null}, state.timers);
    expect(stopped).toHaveBeenCalledOnce();
    renderer.dispose();
  });

  it('keeps one ticker only while a shown 타이머 runs, and releases it on dispose', () => {
    const {renderer, render} = setup();
    const started = vi.spyOn(globalThis, 'setInterval');
    const stopped = vi.spyOn(globalThis, 'clearInterval');
    const ticking = stateWith(`{timer:${SERMON}}`, running);
    render(ticking.layers, ticking.timers);
    render(ticking.layers, ticking.timers);
    expect(started).toHaveBeenCalledOnce();
    const halted = stateWith(`{timer:${SERMON}}`, paused);
    render(halted.layers, halted.timers);
    expect(stopped).toHaveBeenCalledOnce();
    render(ticking.layers, ticking.timers);
    expect(started).toHaveBeenCalledTimes(2);
    renderer.dispose();
    expect(stopped).toHaveBeenCalledTimes(2);
  });

  it('reads a 타이머 that is gone as nothing and keeps the rest of the text', () => {
    const {renderer, render, shown} = setup();
    const started = vi.spyOn(globalThis, 'setInterval');
    const state = stateWith(`남은 시간 {timer:${GONE}}분`, {});
    render(state.layers, state.timers);
    expect(shown()?.textContent).toBe('남은 시간 분');
    expect(started).not.toHaveBeenCalled();
    renderer.dispose();
  });
});
