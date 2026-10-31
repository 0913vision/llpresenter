import {settingsDocument} from '@core/testing/settingsDocument';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {recordingLogger} from '../displays/testing';
import {startOverlays} from './overlays';
import type {SkippedLiveCommand} from './sliceRegistry';
import {LiveStore} from './store';
import {
  CAPTIONS,
  MAIN,
  overlaySettings,
  overlayUuid,
  STAGE,
} from '@core/testing/overlays';

const SECOND_STAGE = overlayUuid(60);
const NOW_NEXT = overlayUuid(61);
const LYRICS_ONLY = overlayUuid(62);
const SERMON = overlayUuid(63);
const FIRST_LOOK = overlayUuid(64);
const SECOND_LOOK = overlayUuid(65);

function layout(id: string, name: string) {
  return {id, name, width: 1920, height: 1080, elements: []};
}

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
    settingsDocument('stage-layouts', {
      format: 'llsettings.stage',
      layouts: [layout(NOW_NEXT, '현재와 다음'), layout(LYRICS_ONLY, '가사')],
    }),
  );
  settings.update(
    settingsDocument('timers', {
      timers: [{id: SERMON, name: '설교', kind: 'countdown', duration: 60}],
    }),
  );
  settings.update(
    settingsDocument('looks', {
      current: FIRST_LOOK,
      looks: [
        {id: FIRST_LOOK, name: 'First', screens: {}},
        {id: SECOND_LOOK, name: 'Second', screens: {}},
      ],
      lyricStyles: [],
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

describe('stage.layout.set', () => {
  it('sets the layout of one stage screen or of every stage screen', () => {
    const {store, send} = setup();
    const start = store.state.version;
    expect(
      send({type: 'stage.layout.set', screenId: STAGE, layoutId: LYRICS_ONLY}),
    ).toBe(true);
    expect(store.state.stageLayouts).toEqual({[STAGE]: LYRICS_ONLY});
    expect(store.state.version).toBe(start + 1);
    send({type: 'stage.layout.set', layoutId: NOW_NEXT});
    expect(store.state.stageLayouts).toEqual({
      [STAGE]: NOW_NEXT,
      [SECOND_STAGE]: NOW_NEXT,
    });
    expect(send({type: 'stage.layout.set', layoutId: NOW_NEXT})).toBe(false);
  });

  it('skips a layout or a screen that is missing, and an audience screen', () => {
    const {store, skipped, send} = setup();
    send({type: 'stage.layout.set', layoutId: overlayUuid(90)});
    send({type: 'stage.layout.set', screenId: MAIN, layoutId: NOW_NEXT});
    send({
      type: 'stage.layout.set',
      screenId: overlayUuid(91),
      layoutId: NOW_NEXT,
    });
    expect(skipped.mock.calls.map(([skip]) => skip.reason)).toEqual([
      'missing-target',
      'missing-target',
      'missing-target',
    ]);
    expect(store.state).not.toHaveProperty('stageLayouts');
  });

  it('lasts until the next Look change, and survives clears', () => {
    const {store, send} = setup();
    send({type: 'stage.layout.set', layoutId: LYRICS_ONLY});
    send({type: 'layer.clear', target: 'all'});
    send({type: 'look.set', lookId: FIRST_LOOK});
    expect(store.state.stageLayouts).toEqual({
      [STAGE]: LYRICS_ONLY,
      [SECOND_STAGE]: LYRICS_ONLY,
    });
    send({type: 'look.set', lookId: SECOND_LOOK});
    expect(store.state).not.toHaveProperty('stageLayouts');
    expect(store.state.lookId).toBe(SECOND_LOOK);
  });
});

describe('stage.timer.set', () => {
  it('chooses and clears the stage 타이머, kept across a Look change', () => {
    const {store, send} = setup();
    expect(send({type: 'stage.timer.set', timerId: SERMON})).toBe(true);
    expect(send({type: 'stage.timer.set', timerId: SERMON})).toBe(false);
    send({type: 'look.set', lookId: SECOND_LOOK});
    expect(store.state.stageTimerId).toBe(SERMON);
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

  it('lets go of a 타이머 once it is deleted', async () => {
    const {store, settings, send} = setup();
    const stop = startOverlays({
      store,
      settings: Promise.resolve(settings.reader),
      log: recordingLogger(),
    });
    onTestFinished(stop);
    await Promise.resolve();
    send({type: 'stage.timer.set', timerId: SERMON});
    settings.update(
      settingsDocument('timers', {
        timers: [{id: SERMON, name: '설교 2', kind: 'countdown', duration: 60}],
      }),
    );
    expect(store.state.stageTimerId).toBe(SERMON);
    settings.update(settingsDocument('timers', {timers: []}));
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
