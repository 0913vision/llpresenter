import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveLayers} from '@shared/live';
import {parseLiveState} from '@shared/schema/liveState';
import {parseTimers, type Timer} from '@shared/schema/timers';
import type {TimerRuns} from '@shared/schema/timerState';
import type {TimerNow} from '@shared/timerClock';
import {
  MAIN,
  overlayUuid,
  PROP,
  TEXT_STYLE,
} from '../../../main/live/testing/overlays';
import {classes} from './classes';
import {DEFAULT_LYRIC_STYLE} from './lyricStyle';
import {OutputRenderer} from './outputRenderer';

const SERMON = overlayUuid(95);
const GONE = overlayUuid(96);
const PLAIN = overlayUuid(97);
const TIMER_START = 5_000_000;
const WALL_START = new Date(2026, 9, 26, 10, 0, 0).getTime();
const screen = {id: MAIN, kind: 'audience'} as const;

let clock: TimerNow = {timer: TIMER_START, wall: WALL_START};

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
  const renderer = new OutputRenderer(parent, {
    lyricStyle: DEFAULT_LYRIC_STYLE,
    mediaUrl: id => `https://media.test/${id}`,
    onError: vi.fn(),
  });
  const list = sermonTimer();
  const render = (layers: LiveLayers, runs: TimerRuns | undefined) =>
    renderer.render(layers, {
      screen,
      timers: {list, runs, now: () => clock},
    });
  const shown = () =>
    parent.querySelector<HTMLElement>(
      `[data-layer="prop"] .${classes.page}.${classes.shown}`,
    );
  return {renderer, render, shown, parent};
}

beforeEach(() => {
  vi.useFakeTimers();
  clock = {timer: TIMER_START, wall: WALL_START};
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
