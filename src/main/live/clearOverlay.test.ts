import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {createMessageId, createMediaId, parseLookId} from '@core/schema/ids';
import {expectSuccess} from '@core/schema/testHelpers';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {parseLiveState} from '@core/schema/liveState';
import {MAX_ACTIVE_MESSAGES} from '@core/schema/overlayState';
import {recordingLogger} from '../displays/testing';
import {LiveStore} from './store';
import {messageLayer} from './messageState';
import {propLayer} from './propState';
import {startOverlays} from './overlays';
import {
  MAIN,
  CAPTIONS,
  PROP,
  STAGE,
  IMAGE_PROP,
  NOTICE,
  TEXT_STYLE,
  overlayUuid,
  overlaySettings,
} from '@core/testing/overlays';

const BASE = 100_000;
const A = createMessageId(overlayUuid(101));
const B = createMessageId(overlayUuid(102));
const stops: Array<() => void> = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.useRealTimers();
});

function setup(changes: Partial<LiveState> = {}) {
  let now = BASE;
  const initial = emptyLiveState();
  const parsed = parseLiveState({
    ...initial,
    lookId: expectSuccess(parseLookId(overlayUuid(500))),
    stageMessage: 'One more chorus',
    outputs: {[MAIN]: true},
    layers: {
      ...initial.layers,
      media: {mediaId: overlayUuid(30), loop: true, startedAt: BASE},
      notice: {noticeId: NOTICE},
      message: messageLayer([
        {
          messageId: A,
          text: 'A',
          targets: [MAIN, CAPTIONS],
          excludedTargets: [],
          startedAt: BASE,
          expiresAt: BASE + 10_000,
        },
        {
          messageId: B,
          text: 'B',
          targets: 'all',
          excludedTargets: [MAIN, CAPTIONS],
          startedAt: BASE,
          expiresAt: BASE + 20_000,
        },
      ]),
      prop: propLayer([
        {
          propId: PROP,
          content: {kind: 'text', text: 'One', style: TEXT_STYLE},
          targets: [MAIN],
        },
        {
          propId: IMAGE_PROP,
          content: {kind: 'image', media: createMediaId(overlayUuid(30))},
          targets: [MAIN, CAPTIONS],
        },
      ]),
    },
    ...changes,
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
  const store = new LiveStore(parsed.value, () => now);
  const settings = overlaySettings();
  stops.push(store.connectSettings(settings.reader));
  const send = (value: unknown): boolean => {
    const command = parseLiveCommand(value);
    if (!command.ok) throw new Error(JSON.stringify(command.error));
    return store.dispatch(command.value);
  };
  return {
    store,
    settings,
    send,
    at: (time: number) => {
      now = time;
    },
  };
}

it('takes one message off all its screens and pauses only that message for undo', () => {
  const {store, send, at} = setup();
  const original = store.state;
  send({type: 'overlay.clear', target: {kind: 'message', messageId: A}});
  expect(
    store.state.layers.message?.items?.map(item => item.messageId),
  ).toEqual([B]);
  expect(store.state.layers.message?.messageId).toBe(B);
  expect(store.state.canUndo).toBe(true);
  at(BASE + 5000);
  send({type: 'clear.undo'});
  expect(store.state.layers.message?.items).toEqual([
    {
      ...original.layers.message?.items?.[0],
      startedAt: BASE + 5000,
      expiresAt: BASE + 15_000,
    },
    original.layers.message?.items?.[1],
  ]);
  expect(store.state.layers.media).toBe(original.layers.media);
  expect(store.state.layers.prop).toBe(original.layers.prop);
  expect(store.state.outputs).toBe(original.outputs);
  expect(store.state.lookId).toBe(original.lookId);
  expect(store.state.canUndo).toBe(false);
});

it('keeps indefinite messages indefinite and supports UUID legacy layers', () => {
  const fixture = setup();
  fixture.send({type: 'message.show', message: {messageId: A, text: 'Legacy'}});
  fixture.send({
    type: 'overlay.clear',
    target: {kind: 'message', messageId: A},
  });
  expect(fixture.store.state.layers.message).toBeNull();
  fixture.at(BASE + 5000);
  fixture.send({type: 'clear.undo'});
  expect(fixture.store.state.layers.message).toEqual({
    messageId: A,
    text: 'Legacy',
  });
  const initial = fixture.store.state;
  const infinite = setup({
    layers: {
      ...initial.layers,
      message: messageLayer([
        {
          messageId: A,
          text: 'Stay',
          targets: 'all',
          excludedTargets: [],
          startedAt: BASE,
          expiresAt: null,
        },
      ]),
    },
  });
  infinite.send({
    type: 'overlay.clear',
    target: {kind: 'message', messageId: A},
  });
  infinite.at(BASE + 5000);
  infinite.send({type: 'clear.undo'});
  expect(infinite.store.state.layers.message?.items?.[0]?.expiresAt).toBeNull();
});

it('takes down just one prop and restores its captured content without rereading settings', () => {
  const {store, send} = setup();
  const original = store.state.layers;
  send({type: 'overlay.clear', target: {kind: 'prop', propId: PROP}});
  expect(store.state.layers.prop?.items?.map(item => item.propId)).toEqual([
    IMAGE_PROP,
  ]);
  expect(store.state.layers.prop?.propId).toBe(IMAGE_PROP);
  send({type: 'clear.undo'});
  expect(store.state.layers.prop).toBe(original.prop);
  send({type: 'overlay.clear', target: {kind: 'prop', propId: IMAGE_PROP}});
  send({type: 'overlay.clear', target: {kind: 'prop', propId: PROP}});
  expect(store.state.layers.prop).toBeNull();
  send({type: 'clear.undo'});
  expect(store.state.layers.prop?.items?.map(item => item.propId)).toEqual([
    PROP,
  ]);
  const legacy = setup({layers: {...original, prop: {propId: PROP}}});
  legacy.send({type: 'overlay.clear', target: {kind: 'prop', propId: PROP}});
  expect(legacy.store.state.layers.prop).toBeNull();
  legacy.send({type: 'clear.undo'});
  expect(legacy.store.state.layers.prop).toEqual({propId: PROP});
});

it('clears and restores one item at the existing active-message cap', () => {
  const items = Array.from({length: MAX_ACTIVE_MESSAGES}, (_, i) => ({
    messageId: createMessageId(overlayUuid(i + 1000)),
    text: 'Fixture',
    targets: [MAIN],
    excludedTargets: [],
    startedAt: BASE,
    expiresAt: null,
  }));
  const id = items[0]?.messageId;
  if (id === undefined) throw new Error('Missing fixture');
  const {store, send} = setup({
    layers: {...emptyLiveState().layers, message: messageLayer(items)},
  });
  send({type: 'overlay.clear', target: {kind: 'message', messageId: id}});
  expect(store.state.layers.message?.items).toHaveLength(
    MAX_ACTIVE_MESSAGES - 1,
  );
  send({type: 'clear.undo'});
  expect(store.state.layers.message?.items).toEqual(items);
});

it('clears and restores stage text without changing layers, Look or outputs', () => {
  const {store, send} = setup();
  const original = store.state;
  send({type: 'overlay.clear', target: {kind: 'stage-message'}});
  expect(store.state.stageMessage).toBeNull();
  expect(store.state.layers).toBe(original.layers);
  expect(store.state.version).toBe(original.version + 1);
  send({type: 'clear.undo'});
  expect(store.state.stageMessage).toBe(original.stageMessage);
  expect(store.state.layers).toEqual(original.layers);
  expect(store.state.outputs).toBe(original.outputs);
  expect(store.state.canUndo).toBe(false);
});

it('ends a stage clear undo when new stage text arrives but preserves other clears', () => {
  const {store, send} = setup();
  send({type: 'overlay.clear', target: {kind: 'stage-message'}});
  send({type: 'stage.message.set', text: 'New message'});
  expect(store.state.canUndo).toBe(false);
  expect(send({type: 'clear.undo'})).toBe(false);
  expect(store.state.stageMessage).toBe('New message');
  send({type: 'overlay.clear', target: {kind: 'message', messageId: A}});
  send({type: 'stage.message.set', text: 'Independent message'});
  expect(store.state.canUndo).toBe(true);
  send({type: 'clear.undo'});
  expect(store.state.stageMessage).toBe('Independent message');
  expect(store.state.layers.message?.items).toHaveLength(2);
});

it('leaves repeated or missing rows as no-ops without losing the prior clear', () => {
  const {store, send} = setup();
  send({type: 'overlay.clear', target: {kind: 'stage-message'}});
  const original = store.state;
  const changed = vi.fn();
  stops.push(store.subscribe(changed));
  for (const target of [
    {kind: 'stage-message'},
    {kind: 'message', messageId: overlayUuid(999)},
    {kind: 'prop', propId: overlayUuid(999)},
  ]) {
    expect(send({type: 'overlay.clear', target})).toBe(false);
    expect(store.state).toBe(original);
  }
  expect(changed).not.toHaveBeenCalled();
  send({type: 'clear.undo'});
  expect(store.state.stageMessage).toBe('One more chorus');
});

it('groups row clears in a batch and cancels undo for new layer content', () => {
  const {store, send} = setup();
  const changed = vi.fn();
  stops.push(store.subscribe(changed));
  send({
    type: 'live.batch',
    commands: [
      {type: 'overlay.clear', target: {kind: 'message', messageId: A}},
      {type: 'overlay.clear', target: {kind: 'prop', propId: PROP}},
    ],
  });
  expect(changed).toHaveBeenCalledOnce();
  send({type: 'clear.undo'});
  expect(
    store.state.layers.message?.items?.map(item => item.messageId),
  ).toEqual([A, B]);
  expect(store.state.layers.prop?.items).toHaveLength(2);
  send({type: 'overlay.clear', target: {kind: 'message', messageId: B}});
  send({type: 'message.show', message: {messageId: A, text: 'New content'}});
  expect(store.state.canUndo).toBe(false);
});

it.each(['message', 'all'] as const)(
  'resumes every message after a row clear followed by %s in a grouped batch',
  target => {
    const {store, send, at} = setup();
    const original = store.state.layers;
    send({
      type: 'live.batch',
      commands: [
        {type: 'layer.clear', target: 'prop'},
        {type: 'overlay.clear', target: {kind: 'message', messageId: A}},
        {type: 'layer.clear', target},
      ],
    });
    at(BASE + 5000);
    send({type: 'clear.undo'});
    expect(store.state.layers.message?.items).toEqual(
      original.message?.items?.map(item => ({
        ...item,
        startedAt: item.startedAt + 5000,
        expiresAt: item.expiresAt === null ? null : item.expiresAt + 5000,
      })),
    );
    expect(store.state.layers.prop).toBe(original.prop);
  },
);

it('resumes multiple cleared message IDs without pausing a retained third message', () => {
  const items = [MAIN, CAPTIONS, STAGE].map((screen, index) => ({
    messageId: createMessageId(overlayUuid(index + 101)),
    text: 'Fixture',
    targets: [screen],
    excludedTargets: [],
    startedAt: BASE,
    expiresAt: BASE + 30_000,
  }));
  const {store, send, at} = setup({
    layers: {...emptyLiveState().layers, message: messageLayer(items)},
  });
  send({
    type: 'live.batch',
    commands: [
      {type: 'overlay.clear', target: {kind: 'message', messageId: A}},
      {type: 'overlay.clear', target: {kind: 'message', messageId: B}},
    ],
  });
  expect(store.state.layers.message?.items).toEqual(items.slice(2));
  at(BASE + 5000);
  send({type: 'clear.undo'});
  expect(store.state.layers.message?.items).toEqual(
    items.map((item, index) =>
      index === 2
        ? item
        : {...item, startedAt: BASE + 5000, expiresAt: BASE + 35_000},
    ),
  );
});

it('retains captured stage text when grouping row and layer clears', () => {
  const {store, send} = setup();
  const original = store.state;
  send({
    type: 'live.batch',
    commands: [
      {type: 'layer.clear', target: 'prop'},
      {type: 'overlay.clear', target: {kind: 'stage-message'}},
      {type: 'layer.clear', target: 'message'},
    ],
  });
  send({type: 'clear.undo'});
  expect(store.state.layers).toEqual(original.layers);
  expect(store.state.stageMessage).toBe(original.stageMessage);
});

it('resumes the cleared deadline while other messages expire normally and old callbacks stay stale', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE);
  const {store, settings, send, at} = setup();
  const stop = startOverlays({
    store,
    settings: Promise.resolve(settings.reader),
    log: recordingLogger(),
  });
  stops.push(stop);
  await Promise.resolve();
  send({type: 'overlay.clear', target: {kind: 'message', messageId: A}});
  at(BASE + 21_000);
  vi.advanceTimersByTime(21_000);
  expect(store.state.layers.message).toBeNull();
  expect(store.state.canUndo).toBe(true);
  send({type: 'clear.undo'});
  expect(
    store.state.layers.message?.items?.map(item => item.messageId),
  ).toEqual([A]);
  expect(store.state.layers.message?.items?.[0]?.expiresAt).toBe(BASE + 31_000);
  expect(
    send({type: 'message.expire', messageId: A, expiresAt: BASE + 10_000}),
  ).toBe(false);
  at(BASE + 31_000);
  vi.advanceTimersByTime(10_000);
  expect(store.state.layers.message).toBeNull();
  stop();
  expect(vi.getTimerCount()).toBe(0);
});
