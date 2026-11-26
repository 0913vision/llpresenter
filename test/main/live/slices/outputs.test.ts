import {expect, it} from 'vitest';
import {parseLiveCommand} from '@core/schema/live/liveCommand';
import {LiveStore} from '@main/live/store';
import {MAIN_SCREEN} from '@fixtures/core/screenIds';

function toggle(store: LiveStore): void {
  const command = parseLiveCommand({
    type: 'output.toggle',
    screenId: MAIN_SCREEN,
  });
  if (!command.ok) throw new Error(JSON.stringify(command.error));
  store.dispatch(command.value);
}

it('turns a screen the other way from where main has it on each toggle, so quick presses all count', () => {
  const store = new LiveStore();
  const states = Array.from({length: 5}, () => {
    toggle(store);
    return store.state.outputs[MAIN_SCREEN];
  });
  expect(states).toEqual([true, false, true, false, true]);
});

it('toggles from a state that output.set gave', () => {
  const store = new LiveStore();
  store.dispatch({type: 'output.set', screenId: MAIN_SCREEN, on: true});
  toggle(store);
  expect(store.state.outputs[MAIN_SCREEN]).toBe(false);
});
