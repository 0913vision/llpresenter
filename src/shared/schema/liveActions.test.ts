import {describe, expect, it, vi} from 'vitest';
import {dispatchLogged, LiveStore} from '../../main/live/store';
import {interruptsSongOutput, isLiveCommand} from '../commands';
import {parseLiveCommand} from './liveCommand';
import {expectSuccess} from './testHelpers';

const ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const OTHER_ID = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
const validActions = [
  {type: 'look.set', lookId: ID},
  {type: 'stage.layout.set', layoutId: ID},
  {type: 'stage.layout.set', screenId: OTHER_ID, layoutId: ID},
  {type: 'stage.message.set', text: 'Start again'},
  {type: 'stage.message.set', text: null},
  {type: 'prop.set', propId: ID, on: true},
  {type: 'prop.set', propId: ID, on: false},
  {type: 'notice.start', noticeId: ID},
  {type: 'notice.start', noticeId: ID, position: 2},
  {type: 'notice.pause'},
  {type: 'notice.stop'},
  {type: 'message.send', text: 'Come forward', targets: 'all', duration: null},
  {
    type: 'message.send',
    text: 'Come forward',
    targets: [ID, OTHER_ID],
    duration: 30,
  },
  {type: 'timer.start', timerId: ID},
  {type: 'timer.pause', timerId: ID},
  {type: 'timer.reset', timerId: ID},
  {type: 'audio.play'},
  {type: 'audio.play', source: {kind: 'media', mediaId: ID}},
  {
    type: 'audio.play',
    source: {kind: 'playlist', playlistId: ID, position: 0},
  },
  {type: 'audio.pause'},
  {type: 'audio.next'},
  {type: 'audio.previous'},
  {type: 'audio.fadeOut'},
  {type: 'audio.volume.set', volume: 0},
  {type: 'audio.volume.set', volume: 55.5},
  {type: 'audio.volume.set', volume: 100},
  {type: 'macro.run', macroId: ID},
  {type: 'item.start', itemId: ID},
];

describe('M3 live action contracts', () => {
  it.each(validActions)('accepts $type %j', command => {
    expect(expectSuccess(parseLiveCommand(command))).toEqual(command);
    expect(isLiveCommand(command)).toBe(true);
    expect(interruptsSongOutput(expectSuccess(parseLiveCommand(command)))).toBe(
      false,
    );
  });

  it.each([
    {type: 'look.set', lookId: 'deleted'},
    {type: 'stage.layout.set', layoutId: ID, screenId: 'main'},
    {type: 'stage.layout.set', layoutId: null},
    {type: 'stage.message.set', text: '  '},
    {type: 'stage.message.set'},
    {type: 'prop.set', propId: ID, on: 'on'},
    {type: 'prop.set', propId: 'prop', on: false},
    {type: 'notice.start', noticeId: ID, position: -1},
    {type: 'notice.start', noticeId: ID, position: 1.5},
    {type: 'notice.start', noticeId: 'set'},
    {type: 'message.send', text: '', targets: 'all', duration: null},
    {type: 'message.send', text: 'Hello', targets: [], duration: null},
    {type: 'message.send', text: 'Hello', targets: [ID, ID], duration: null},
    {type: 'message.send', text: 'Hello', targets: ['main'], duration: null},
    {type: 'message.send', text: 'Hello', targets: 'all'},
    {type: 'message.send', text: 'Hello', targets: 'all', duration: -1},
    {type: 'message.send', text: 'Hello', targets: 'all', duration: Infinity},
    {type: 'timer.start', timerId: 'timer'},
    {type: 'timer.pause'},
    {type: 'timer.reset', timerId: null},
    {type: 'audio.play', source: null},
    {type: 'audio.play', source: {kind: 'media', mediaId: 'file'}},
    {type: 'audio.play', source: {kind: 'playlist', playlistId: ID}},
    {
      type: 'audio.play',
      source: {kind: 'playlist', playlistId: ID, position: -1},
    },
    {type: 'audio.play', source: {kind: 'other'}},
    {type: 'audio.volume.set', volume: -1},
    {type: 'audio.volume.set', volume: 101},
    {type: 'audio.volume.set', volume: NaN},
    {type: 'macro.run', macroId: 'macro'},
    {type: 'item.start', itemId: 'row'},
  ])('rejects malformed action %j', command => {
    expect(parseLiveCommand(command).ok).toBe(false);
    expect(isLiveCommand(command)).toBe(false);
  });

  it('strips fields at each level and rejects non-object sources', () => {
    const command = {
      type: 'audio.play',
      source: {kind: 'media', mediaId: ID},
    };
    expect(
      expectSuccess(
        parseLiveCommand({
          ...command,
          unknown: true,
          source: {...command.source, playing: true},
        }),
      ),
    ).toEqual(command);
    const inherited: unknown = Object.create(command.source);
    for (const source of [Object.assign([], command.source), inherited]) {
      expect(parseLiveCommand({...command, source}).ok).toBe(false);
    }
  });

  it('logs every unsupported action and preserves state, undo, and listeners', () => {
    const store = new LiveStore();
    store.dispatch({
      type: 'message.show',
      message: {messageId: 'old', text: 'Old'},
    });
    store.dispatch({type: 'layer.clear', target: 'message'});
    expect(store.state.canUndo).toBe(true);
    const before = store.state;
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const log = {info: vi.fn(), warn: vi.fn(), error: vi.fn(), flush: vi.fn()};
    try {
      for (const value of validActions) {
        const command = expectSuccess(parseLiveCommand(value));
        dispatchLogged(store, command, log);
        expect(store.dispatch(command)).toBe(false);
        expect(store.state).toBe(before);
      }
      expect(log.warn.mock.calls).toEqual(
        validActions.map(({type}) => ['unhandled live command', {type}]),
      );
      expect(listener).not.toHaveBeenCalled();
      expect(store.listenerCount).toBe(1);
      expect(log.error).not.toHaveBeenCalled();
      store.dispatch({type: 'clear.undo'});
      expect(store.state.layers.message?.text).toBe('Old');
    } finally {
      unsubscribe();
    }
    expect(store.listenerCount).toBe(0);
  });
});
