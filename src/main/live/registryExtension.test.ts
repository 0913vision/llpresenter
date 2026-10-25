import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {LiveStore} from './store';

vi.mock('./slices', () => import('./fixtures/slices'));

describe('slice module discovery', () => {
  it('initializes and runs a new fixture slice through the real store without a registration entry', () => {
    const store = new LiveStore(undefined, () => 42);
    expect(store.state.outputs).toEqual({'fixture-loaded': true});
    expect(
      store.dispatch({type: 'output.set', screenId: 'main', on: true}),
    ).toBe(true);
    expect(store.state.outputs).toEqual({'fixture-loaded': true, main: true});
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
