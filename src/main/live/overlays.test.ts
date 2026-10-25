import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import {
  parseActiveMessages,
  parseActiveProps,
  MAX_ACTIVE_PROPS,
  MAX_NOTICE_IMAGES,
  MAX_TARGET_SCREENS,
} from '@shared/schema/overlayState';
import {recordingLogger} from '../displays/testing';
import {
  noticePosition,
  nextNoticeChange,
  MAX_OVERLAY_TIMER_MS,
} from '@shared/noticeClock';
import {startOverlays} from './overlays';
import {dispatchLogged, LiveStore} from './store';
import {
  CAPTIONS,
  IMAGE_PROP,
  IMAGES,
  MAIN,
  NOTICE,
  overlaySettings,
  overlayUuid,
  PROP,
  settingsDocument,
  STAGE,
  TEXT_STYLE,
} from './testing/overlays';

const BASE = 100_000;
const stops: Array<() => void> = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE);
});
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.useRealTimers();
});

async function setup() {
  const store = new LiveStore();
  const settings = overlaySettings();
  const log = recordingLogger();
  const stop = startOverlays({
    store,
    settings: Promise.resolve(settings.reader),
    log,
  });
  stops.push(stop);
  await Promise.resolve();
  const send = (value: unknown): void => {
    const command = parseLiveCommand(value);
    if (!command.ok) throw new Error(JSON.stringify(command.error));
    dispatchLogged(store, command.value, log);
  };
  const message = (
    targets: 'all' | readonly string[] = [MAIN],
    duration: number | null = 30,
    text = 'Fixture message',
  ): void => send({type: 'message.send', targets, duration, text});
  return {store, settings, log, stop, send, message};
}

describe('overlay live state and lifecycle', () => {
  it('classifies all three invalid overlay children once and continues the batch without losing undo', async () => {
    const {store, settings, send, message, log} = await setup();
    send({type: 'prop.set', propId: PROP, on: true});
    message();
    send({type: 'notice.start', noticeId: NOTICE});
    send({type: 'layer.clear', target: 'prop'});
    settings.update(
      settingsDocument(
        'props',
        {
          props: [
            {
              id: PROP,
              name: 'Too many targets',
              content: {kind: 'text', text: 'Fixture', style: TEXT_STYLE},
              targets: Array.from(
                {length: MAX_TARGET_SCREENS + 1},
                (_, index) => overlayUuid(1000 + index),
              ),
            },
          ],
        },
        2,
      ),
    );
    const before = store.state;
    const changed = vi.fn();
    stops.push(store.subscribe(changed));
    send({
      type: 'live.batch',
      commands: [
        {
          type: 'message.send',
          text: 'Overflow',
          targets: [MAIN],
          duration: Number.MAX_SAFE_INTEGER,
        },
        {type: 'prop.set', propId: PROP, on: true},
        {type: 'notice.start', noticeId: NOTICE, position: IMAGES.length},
        {type: 'stage.message.set', text: 'Accepted sibling'},
      ],
    });
    expect(store.state.layers).toBe(before.layers);
    expect(store.state.stageMessage).toBe('Accepted sibling');
    expect(store.state.version).toBe(before.version + 1);
    expect(store.state.canUndo).toBe(true);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(log.entries).toMatchObject([
      {
        level: 'warn',
        message: 'skipped live command',
        detail: {
          type: 'message.send',
          reason: 'invalid-overlay',
          error: {field: '0.expiresAt'},
        },
      },
      {
        level: 'warn',
        message: 'skipped live command',
        detail: {
          type: 'prop.set',
          reason: 'invalid-overlay',
          error: {field: '0.targets'},
        },
      },
      {
        level: 'warn',
        message: 'skipped live command',
        detail: {
          type: 'notice.start',
          reason: 'invalid-overlay',
          error: {field: 'position'},
        },
      },
    ]);
    send({type: 'clear.undo'});
    expect(store.state.layers.prop?.items?.[0]?.propId).toBe(PROP);
    expect(store.state.layers.message).toBe(before.layers.message);
    expect(store.state.layers.notice).toBe(before.layers.notice);
  });

  it('keeps state, undo and listeners unchanged when the entire batch fails overlay validation', async () => {
    const {store, send, message, log} = await setup();
    message();
    send({type: 'layer.clear', target: 'message'});
    const before = store.state;
    const changed = vi.fn();
    stops.push(store.subscribe(changed));
    send({
      type: 'live.batch',
      commands: [
        {
          type: 'message.send',
          text: 'Overflow',
          targets: [MAIN],
          duration: Number.MAX_SAFE_INTEGER,
        },
        {type: 'notice.start', noticeId: NOTICE, position: IMAGES.length},
      ],
    });
    expect(store.state).toBe(before);
    expect(changed).not.toHaveBeenCalled();
    expect(log.entries).toHaveLength(2);
    expect(log.messages('error')).toEqual([]);
    send({type: 'clear.undo'});
    expect(store.state.layers.message?.text).toBe('Fixture message');
  });

  it('retains a legacy message on untouched screens and makes repeated prop and notice starts no-ops', async () => {
    const {store, send, message} = await setup();
    send({
      type: 'message.show',
      message: {messageId: 'legacy', text: 'Legacy'},
    });
    message([MAIN], null, 'New');
    expect(
      store.state.layers.message?.items?.map(item => [item.text, item.targets]),
    ).toEqual([
      ['Legacy', [CAPTIONS, STAGE]],
      ['New', [MAIN]],
    ]);
    send({type: 'prop.set', propId: PROP, on: true});
    send({type: 'notice.start', noticeId: NOTICE});
    const before = store.state;
    send({type: 'prop.set', propId: PROP, on: true});
    send({type: 'notice.start', noticeId: NOTICE});
    expect(store.state).toBe(before);
  });

  it('expires a 30-second message once from main, keeping untargeted messages', async () => {
    const {store, message} = await setup();
    message([CAPTIONS], null, 'Caption');
    message([MAIN], 30, 'Main');
    const items = store.state.layers.message?.items;
    expect(items).toHaveLength(2);
    expect(parseActiveMessages(items)).toEqual({ok: true, value: items});
    expect(vi.getTimerCount()).toBe(1);
    const changed = vi.fn();
    store.subscribe(changed);
    vi.advanceTimersByTime(29_999);
    expect(changed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(store.state.layers.message?.items?.map(item => item.text)).toEqual([
      'Caption',
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replaces only overlapping targets and freezes all-screen targets at send time', async () => {
    const {store, settings, message} = await setup();
    message('all', null, 'First');
    message([MAIN], null, 'Second');
    expect(
      store.state.layers.message?.items?.map(item => [item.text, item.targets]),
    ).toEqual([
      ['First', [CAPTIONS, STAGE]],
      ['Second', [MAIN]],
    ]);
    const screens = settings.reader.get('screens');
    if (screens.name !== 'screens') throw new Error('Missing screens');
    const added = overlayUuid(99);
    settings.update(
      settingsDocument(
        'screens',
        {
          screens: [
            ...screens.value.screens,
            {id: added, name: 'New', kind: 'audience', method: 'window'},
          ],
        },
        2,
      ),
    );
    expect(
      store.state.layers.message?.items?.some(
        item => item.targets !== 'all' && item.targets.some(id => id === added),
      ),
    ).toBe(false);
    for (let count = 0; count < 250; count += 1) {
      message([MAIN], null, String(count));
    }
    expect(store.state.layers.message?.items).toHaveLength(2);
  });

  it('ignores stale and early expiry requests after a clear and restores the time left', async () => {
    const {store, message, send} = await setup();
    message();
    const item = store.state.layers.message?.items?.[0];
    if (item?.expiresAt == null) throw new Error('Missing expiry');
    send({
      type: 'message.expire',
      messageId: item.messageId,
      expiresAt: item.expiresAt,
    });
    expect(store.state.layers.message).not.toBeNull();
    vi.advanceTimersByTime(10_000);
    send({type: 'layer.clear', target: 'message'});
    expect(store.state.layers.message).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    send({type: 'clear.undo'});
    expect(store.state.layers.message?.items?.[0]?.expiresAt).toBe(
      BASE + 90_000,
    );
    send({
      type: 'message.expire',
      messageId: item.messageId,
      expiresAt: item.expiresAt,
    });
    expect(store.state.layers.message).not.toBeNull();
    vi.advanceTimersByTime(19_999);
    expect(store.state.layers.message).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(store.state.layers.message).toBeNull();
  });

  it('does not revive a naturally expired message through an unrelated clear undo', async () => {
    const {store, send, message} = await setup();
    send({type: 'prop.set', propId: PROP, on: true});
    message();
    send({type: 'layer.clear', target: 'prop'});
    vi.advanceTimersByTime(30_000);
    send({type: 'clear.undo'});
    expect(store.state.layers.prop?.items).toHaveLength(1);
    expect(store.state.layers.message).toBeNull();
  });

  it('keeps an expiry between batch clears out of the grouped undo snapshot', async () => {
    const {store, send, message, stop} = await setup();
    send({type: 'prop.set', propId: PROP, on: true});
    send({type: 'notice.start', noticeId: NOTICE});
    message();
    const item = store.state.layers.message?.items?.[0];
    if (item?.expiresAt == null) throw new Error('Missing message');
    stop();
    vi.setSystemTime(BASE + 30_000);
    send({
      type: 'live.batch',
      commands: [
        {type: 'layer.clear', target: 'prop'},
        {
          type: 'message.expire',
          messageId: item.messageId,
          expiresAt: item.expiresAt,
        },
        {type: 'layer.clear', target: 'notice'},
      ],
    });
    send({type: 'clear.undo'});
    expect(store.state.layers.prop).not.toBeNull();
    expect(store.state.layers.notice).not.toBeNull();
    expect(store.state.layers.message).toBeNull();
  });

  it('rotates without main broadcasts, pauses, resumes, and holds the nonloop final image', async () => {
    const {store, send} = await setup();
    send({type: 'notice.start', noticeId: NOTICE});
    const playback = () => {
      const value = store.state.layers.notice?.playback;
      if (value === undefined) throw new Error('Missing playback');
      return value;
    };
    const changed = vi.fn();
    store.subscribe(changed);
    vi.advanceTimersByTime(7_000);
    expect(noticePosition(playback(), Date.now())).toBe(1);
    expect(changed).not.toHaveBeenCalled();
    send({type: 'notice.pause'});
    vi.advanceTimersByTime(60_000);
    expect(noticePosition(playback(), Date.now())).toBe(1);
    expect(nextNoticeChange(playback(), Date.now())).toBeNull();
    send({type: 'notice.start', noticeId: NOTICE});
    vi.advanceTimersByTime(2_999);
    expect(noticePosition(playback(), Date.now())).toBe(1);
    vi.advanceTimersByTime(1);
    expect(noticePosition(playback(), Date.now())).toBe(2);
    expect(nextNoticeChange(playback(), Date.now())).toBeNull();
    vi.advanceTimersByTime(100_000);
    expect(noticePosition(playback(), Date.now())).toBe(2);
    send({type: 'notice.start', noticeId: NOTICE, position: 0});
    expect(noticePosition(playback(), Date.now())).toBe(0);
  });

  it('applies notice interval, looping and targets edits immediately, retaining pause', async () => {
    const {store, settings, send} = await setup();
    send({type: 'notice.start', noticeId: NOTICE});
    vi.advanceTimersByTime(7_000);
    send({type: 'notice.pause'});
    settings.update(
      settingsDocument(
        'notices',
        {
          sets: [
            {
              id: NOTICE,
              name: 'Edited',
              media: IMAGES,
              interval: 2,
              loop: true,
              targets: [CAPTIONS],
            },
          ],
        },
        2,
      ),
    );
    const playback = store.state.layers.notice?.playback;
    expect(playback).toMatchObject({
      position: 1,
      interval: 2,
      loop: true,
      targets: [CAPTIONS],
      pausedAt: Date.now(),
    });
    send({type: 'notice.start', noticeId: NOTICE});
    const resumed = store.state.layers.notice?.playback;
    if (resumed === undefined) throw new Error('Missing playback');
    vi.advanceTimersByTime(4_000);
    expect(noticePosition(resumed, Date.now())).toBe(0);
    settings.update(settingsDocument('notices', {sets: []}, 3));
    expect(store.state.layers.notice).toBeNull();
  });

  it('restores props, message time left and notice phase from one batch clear, keeping stage text', async () => {
    const {store, message, send} = await setup();
    send({type: 'prop.set', propId: PROP, on: true});
    send({type: 'prop.set', propId: IMAGE_PROP, on: true});
    message();
    send({type: 'notice.start', noticeId: NOTICE});
    send({type: 'stage.message.set', text: 'Stage only'});
    vi.advanceTimersByTime(7_000);
    send({
      type: 'live.batch',
      commands: ['prop', 'message', 'notice'].map(target => ({
        type: 'layer.clear',
        target,
      })),
    });
    expect(store.state.layers).toMatchObject({
      prop: null,
      message: null,
      notice: null,
    });
    expect(store.state.stageMessage).toBe('Stage only');
    vi.advanceTimersByTime(60_000);
    send({type: 'clear.undo'});
    expect(store.state.layers.prop?.items).toHaveLength(2);
    expect(store.state.layers.message?.items?.[0]?.expiresAt).toBe(
      BASE + 90_000,
    );
    const notice = store.state.layers.notice?.playback;
    if (notice === undefined) throw new Error('Missing notice');
    expect(noticePosition(notice, Date.now())).toBe(1);
    send({type: 'layer.clear', target: 'all'});
    expect(store.state.stageMessage).toBe('Stage only');
    send({type: 'stage.message.set', text: null});
    expect(store.state.stageMessage).toBeNull();
  });

  it('updates several active props from settings and removes deleted props', async () => {
    const {store, settings, send} = await setup();
    send({type: 'prop.set', propId: PROP, on: true});
    send({type: 'prop.set', propId: IMAGE_PROP, on: true});
    settings.update(
      settingsDocument(
        'props',
        {
          props: [
            {
              id: PROP,
              name: 'Edited',
              targets: [STAGE],
              content: {kind: 'text', text: 'Changed', style: TEXT_STYLE},
            },
          ],
        },
        2,
      ),
    );
    expect(store.state.layers.prop?.items).toMatchObject([
      {propId: PROP, targets: [STAGE], content: {text: 'Changed'}},
    ]);
    expect(parseActiveProps(store.state.layers.prop?.items)).toEqual({
      ok: true,
      value: store.state.layers.prop?.items,
    });
  });

  it('warns for missing targets and continues a batch with the last valid state', async () => {
    const {store, log, send} = await setup();
    send({
      type: 'live.batch',
      commands: [
        {type: 'prop.set', propId: overlayUuid(999), on: true},
        {
          type: 'message.send',
          text: 'Missing',
          targets: [overlayUuid(999)],
          duration: 30,
        },
        {type: 'notice.start', noticeId: NOTICE, position: IMAGES.length},
        {type: 'prop.set', propId: PROP, on: true},
      ],
    });
    expect(log.messages('warn')).toEqual([
      'skipped live command',
      'skipped live command',
      'skipped live command',
    ]);
    expect(log.messages('error')).toEqual([]);
    expect(log.entries.map(entry => entry.detail)).toMatchObject([
      {reason: 'missing-target'},
      {reason: 'missing-target'},
      {reason: 'invalid-overlay', error: {field: 'position'}},
    ]);
    expect(store.state.layers.prop?.items).toHaveLength(1);
    expect(store.state.layers.notice).toBeNull();
    expect(store.state.layers.message).toBeNull();
  });

  it('caps active props and notice images without replacing the last good state', async () => {
    const {store, settings, send, log} = await setup();
    const props = Array.from({length: MAX_ACTIVE_PROPS + 1}, (_, index) => ({
      id: overlayUuid(1000 + index),
      name: String(index),
      targets: [MAIN],
      content: {kind: 'text', text: 'Bounded', style: TEXT_STYLE},
    }));
    settings.update(settingsDocument('props', {props}, 2));
    for (const prop of props) {
      send({type: 'prop.set', propId: prop.id, on: true});
    }
    expect(store.state.layers.prop?.items).toHaveLength(MAX_ACTIVE_PROPS);
    send({type: 'notice.start', noticeId: NOTICE});
    const before = store.state.layers.notice;
    settings.update(
      settingsDocument(
        'notices',
        {
          sets: [
            {
              id: NOTICE,
              name: 'Too many',
              media: Array.from(
                {length: MAX_NOTICE_IMAGES + 1},
                () => IMAGES[0],
              ),
              interval: 5,
              loop: true,
              targets: [MAIN],
            },
          ],
        },
        2,
      ),
    );
    expect(store.state.layers.notice).toBe(before);
    expect(log.messages('error')).toHaveLength(0);
    expect(log.entries).toHaveLength(2);
    expect(log.entries.map(entry => entry.detail)).toMatchObject([
      {type: 'prop.set', reason: 'invalid-overlay'},
      {
        type: 'notice.start',
        reason: 'invalid-overlay',
        error: {field: 'media'},
      },
    ]);
  });

  it('handles zero and long deadlines and releases timers and listeners on dispose', async () => {
    const {store, settings, message, stop} = await setup();
    message([MAIN], 0);
    vi.advanceTimersByTime(0);
    expect(store.state.layers.message).toBeNull();
    message([MAIN], MAX_OVERLAY_TIMER_MS / 1000 + 30);
    vi.advanceTimersByTime(MAX_OVERLAY_TIMER_MS);
    expect(store.state.layers.message).not.toBeNull();
    expect(vi.getTimerCount()).toBe(1);
    expect(settings.listeners.size).toBe(1);
    expect(store.listenerCount).toBe(1);
    stop();
    stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(settings.listeners.size).toBe(0);
    expect(store.listenerCount).toBe(0);
    vi.advanceTimersByTime(30_000);
    expect(store.state.layers.message).not.toBeNull();
  });

  it('does not attach a late settings subscription after dispose and logs startup failure', async () => {
    const store = new LiveStore();
    const settings = overlaySettings();
    const log = recordingLogger();
    let resolve: (reader: typeof settings.reader) => void = () => undefined;
    const pending = new Promise<typeof settings.reader>(done => {
      resolve = done;
    });
    const stop = startOverlays({store, settings: pending, log});
    stop();
    resolve(settings.reader);
    await Promise.resolve();
    expect(settings.listeners.size).toBe(0);
    expect(store.listenerCount).toBe(0);
    stops.push(
      startOverlays({
        store,
        settings: Promise.reject(new Error('Broken settings')),
        log,
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(log.messages('error')).toEqual([
      'could not connect overlay settings',
    ]);
  });
});
