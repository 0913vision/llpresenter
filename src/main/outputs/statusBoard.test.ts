import {describe, expect, it, vi} from 'vitest';
import type {FrameRate} from './frameRates';
import type {ScreenOutputState} from './manager';
import {OutputStatusBoard} from './statusBoard';

function setUp() {
  const states = new Map<string, ScreenOutputState>([
    ['main', {placement: 'fullscreen', renderer: 'running'}],
  ]);
  const rates = new Map<string, FrameRate>([
    ['main', {fps: 59.9, status: 'normal'}],
  ]);
  const board = new OutputStatusBoard({
    screenStates: () => states,
    frameRate: screenId => rates.get(screenId) ?? null,
  });
  const listener = vi.fn();
  board.subscribe(listener);
  return {board, states, rates, listener};
}

describe('OutputStatusBoard', () => {
  it('builds each screen from its placement, renderer state, and frame rate', () => {
    const {board} = setUp();
    expect(board.snapshot()).toEqual({
      main: {
        placement: 'fullscreen',
        renderer: 'running',
        fps: 59.9,
        fpsLow: false,
      },
    });
  });

  it('gives no frame rate for an output that is off', () => {
    const {board, states} = setUp();
    states.set('main', {placement: 'off', renderer: 'running'});
    expect(board.snapshot()['main']).toMatchObject({fps: null, fpsLow: false});
  });

  it('announces a change once and stays quiet while nothing changes', () => {
    const {board, states, listener} = setUp();
    board.refresh();
    board.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
    states.set('main', {placement: 'fullscreen', renderer: 'limited'});
    board.refresh();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.lastCall?.[0]).toMatchObject({
      main: {renderer: 'limited'},
    });
  });

  it('passes the monitor number on and announces a change of it', () => {
    const {board, states, listener} = setUp();
    states.set('main', {
      placement: 'fullscreen',
      renderer: 'running',
      monitor: 2,
    });
    board.refresh();
    expect(listener.mock.lastCall?.[0]).toMatchObject({main: {monitor: 2}});
    states.set('main', {
      placement: 'monitorMissing',
      renderer: 'running',
      monitor: 3,
    });
    board.refresh();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.lastCall?.[0]).toMatchObject({
      main: {placement: 'monitorMissing', monitor: 3},
    });
    expect(board.snapshot()['main']).toHaveProperty('monitor', 3);
  });

  it('leaves the monitor out for a screen that never had one', () => {
    const {board} = setUp();
    expect(board.snapshot()['main']).not.toHaveProperty('monitor');
  });

  it('announces a low frame rate', () => {
    const {board, rates, listener} = setUp();
    board.refresh();
    rates.set('main', {fps: 41, status: 'low'});
    board.refresh();
    expect(listener.mock.lastCall?.[0]).toMatchObject({
      main: {fps: 41, fpsLow: true},
    });
  });

  it('stops announcing to a listener that left', () => {
    const {board, listener} = setUp();
    const other = vi.fn();
    const unsubscribe = board.subscribe(other);
    unsubscribe();
    board.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });
});
