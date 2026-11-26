import {expect, it} from 'vitest';
import {parseLiveCommand} from '@core/schema/live/liveCommand';
import {LiveStore} from '@main/live/store';
import {PROP, overlaySettings} from '@fixtures/core/overlays';

function setup() {
  const store = new LiveStore();
  store.connectSettings(overlaySettings().reader);
  const toggle = (): boolean => {
    const command = parseLiveCommand({type: 'prop.toggle', propId: PROP});
    if (!command.ok) throw new Error(JSON.stringify(command.error));
    store.dispatch(command.value);
    return (store.state.layers.prop?.items ?? []).some(
      item => item.propId === PROP,
    );
  };
  return {store, toggle};
}

it('puts a 그래픽 on and takes it off from where main has it on each toggle, so quick presses all count', () => {
  const {toggle} = setup();
  expect(Array.from({length: 4}, toggle)).toEqual([true, false, true, false]);
});

it('takes off a 그래픽 that prop.set put on', () => {
  const {store, toggle} = setup();
  store.dispatch({type: 'prop.set', propId: PROP, on: true});
  expect(toggle()).toBe(false);
});
