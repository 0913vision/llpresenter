import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {LiveStore} from '@main/live/store';
import {FIXTURE_LOADED_SCREEN, MAIN_SCREEN} from '@fixtures/core/screenIds';

vi.mock('@main/live/slices', () => import('@fixtures/main/live/slices'));

describe('slice module discovery', () => {
  it('initializes and runs a new fixture slice through the real store without a registration entry', () => {
    const store = new LiveStore(undefined, () => 42);
    expect(store.state.outputs).toEqual({[FIXTURE_LOADED_SCREEN]: true});
    expect(
      store.dispatch({type: 'output.set', screenId: MAIN_SCREEN, on: true}),
    ).toBe(true);
    expect(store.state.outputs).toEqual({
      [FIXTURE_LOADED_SCREEN]: true,
      [MAIN_SCREEN]: true,
    });
    expect(store.state.layers.message).toEqual({
      messageId: 'fixture-reduced',
      text: '42',
    });
    expect(store.state.version).toBe(1);
  });

  it('preserves an explicit starting state instead of applying slice defaults again', () => {
    const initial = emptyLiveState();
    const store = new LiveStore(initial);
    expect(store.state).toBe(initial);
  });
});
