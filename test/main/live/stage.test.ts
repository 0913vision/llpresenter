import {settingsDocument} from '@fixtures/core/settingsDocument';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {parseLiveCommand} from '@core/schema/liveCommand';
import type {SkippedLiveCommand} from '@main/live/sliceRegistry';
import {LiveStore} from '@main/live/store';
import {
  CAPTIONS,
  MAIN,
  overlaySettings,
  overlayUuid,
  STAGE,
} from '@fixtures/core/overlays';

const SECOND_STAGE = overlayUuid(60);
const SERMON = overlayUuid(63);

function setup() {
  const store = new LiveStore();
  const settings = overlaySettings();
  settings.update(
    settingsDocument('screens', {
      screens: [
        {id: MAIN, name: 'Main', kind: 'audience', method: 'fullscreen'},
        {id: CAPTIONS, name: 'Captions', kind: 'audience', method: 'capture'},
        {id: STAGE, name: 'Stage', kind: 'stage', method: 'fullscreen'},
        {id: SECOND_STAGE, name: 'Band', kind: 'stage', method: 'window'},
      ],
    }),
  );
  settings.update(
    settingsDocument('timers', {
      timers: [{id: SERMON, name: '설교', kind: 'countdown', duration: 60}],
    }),
  );
  onTestFinished(store.connectSettings(settings.reader));
  const skipped = vi.fn<(skip: SkippedLiveCommand) => void>();
  const send = (value: object): boolean => {
    const command = parseLiveCommand(value);
    if (!command.ok) throw new Error(JSON.stringify(command.error));
    return store.dispatch(command.value, undefined, skipped);
  };
  return {store, settings, skipped, send};
}

describe('stage.timer.set', () => {
  it('chooses and clears the stage 타이머', () => {
    const {store, send} = setup();
    expect(send({type: 'stage.timer.set', timerId: SERMON})).toBe(true);
    expect(send({type: 'stage.timer.set', timerId: SERMON})).toBe(false);
    expect(send({type: 'stage.timer.set', timerId: null})).toBe(true);
    expect(store.state).not.toHaveProperty('stageTimerId');
    expect(send({type: 'stage.timer.set', timerId: null})).toBe(false);
  });

  it('skips a missing 타이머', () => {
    const {store, skipped, send} = setup();
    send({type: 'stage.timer.set', timerId: overlayUuid(92)});
    expect(skipped).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'missing-target'}),
    );
    expect(store.state).not.toHaveProperty('stageTimerId');
  });
});

describe('the next 장 in slide.show', () => {
  it('keeps the next 장 with the live one, and a lyrics clear drops both', () => {
    const {store, send} = setup();
    const slide = {
      itemId: 'item-1',
      position: 0,
      label: '1절',
      lines: ['첫 줄'],
      next: {label: '후렴', lines: ['둘째 줄']},
    };
    send({type: 'slide.show', slide});
    expect(store.state.layers.slide).toEqual(slide);
    send({type: 'layer.clear', target: 'slide'});
    expect(store.state.layers.slide).toBeNull();
    send({type: 'clear.undo'});
    expect(store.state.layers.slide?.next).toEqual(slide.next);
  });
});
