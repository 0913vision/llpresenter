import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {createTimerId} from '@core/schema/ids';
import {parseLiveState} from '@core/schema/liveState';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {
  MAIN,
  overlayUuid,
  PROP,
  IMAGE_PROP,
  TEXT_STYLE,
} from '@fixtures/core/overlays';
import {
  overlayRefreshCommands,
  timerRefreshCommands,
} from '@main/live/overlayRefresh';

function stateWith(fields: object) {
  const empty = emptyLiveState();
  return expectSuccess(parseLiveState({...empty, ...fields}));
}

function layers(fields: object) {
  return stateWith({layers: {...emptyLiveState().layers, ...fields}});
}

const textProp = (propId: string) => ({
  propId,
  content: {kind: 'text', text: 'Fixture prop', style: TEXT_STYLE},
  targets: [MAIN],
});

describe('overlayRefreshCommands', () => {
  it('sets each active 그래픽 on while it is still saved and off once it is gone', () => {
    const state = layers({
      prop: {propId: 'summary', items: [textProp(PROP), textProp(IMAGE_PROP)]},
    });
    const props = settingsDocument('props', {
      props: [
        {
          id: PROP,
          name: 'Kept',
          targets: [MAIN],
          content: {kind: 'text', text: 'Kept', style: TEXT_STYLE},
        },
      ],
    });

    expect(overlayRefreshCommands(state, props)).toEqual([
      {type: 'prop.set', propId: PROP, on: true},
      {type: 'prop.set', propId: IMAGE_PROP, on: false},
    ]);
  });
});

describe('timerRefreshCommands', () => {
  const kept = createTimerId(overlayUuid(90));
  const removed = createTimerId(overlayUuid(91));
  const running = {state: 'running', since: 0, countedMs: 0, day: 0};
  const timers = settingsDocument('timers', {
    timers: [{id: kept, name: 'Keep', kind: 'countdown', duration: 30}],
  });

  it('resets the runs of removed 타이머 and clears a removed stage pick', () => {
    const state = stateWith({
      timers: {[kept]: running, [removed]: running},
      stageTimerId: removed,
    });

    expect(timerRefreshCommands(state, timers)).toEqual([
      {type: 'timer.reset', timerId: removed},
      {type: 'stage.timer.set', timerId: null},
    ]);
  });

  it('changes nothing while every run and the stage pick are still defined, or for other settings', () => {
    const state = stateWith({timers: {[kept]: running}, stageTimerId: kept});

    expect(timerRefreshCommands(state, timers)).toEqual([]);
    expect(
      timerRefreshCommands(state, settingsDocument('labels', {labels: []})),
    ).toEqual([]);
  });
});
