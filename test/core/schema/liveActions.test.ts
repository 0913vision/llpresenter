import {describe, expect, it} from 'vitest';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

const ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const OTHER_ID = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
const validActions = [
  {type: 'message.expire', messageId: ID, expiresAt: 1_700_000_000_000},
  {type: 'theme.set', themeId: ID},
  {type: 'stage.message.set', text: 'Start again'},
  {type: 'stage.message.set', text: null},
  {type: 'stage.timer.set', timerId: ID},
  {type: 'stage.timer.set', timerId: null},
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

describe('live action commands', () => {
  it.each(validActions)('accepts $type %j', command => {
    expect(expectSuccess(parseLiveCommand(command))).toEqual(command);
  });

  it.each([
    {type: 'theme.set', themeId: 'deleted'},
    {type: 'stage.message.set', text: '  '},
    {type: 'stage.message.set'},
    {type: 'stage.timer.set', timerId: 'timer'},
    {type: 'stage.timer.set'},
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

  it.each([
    {trackVersion: -1, since: 0},
    {trackVersion: 1, since: NaN},
    {trackVersion: 1, since: Infinity},
    {trackVersion: 1, since: -1},
  ])('rejects malformed fade completion %j', fields => {
    expect(
      parseLiveCommand({type: 'audio.fadeOut.complete', ...fields}).ok,
    ).toBe(false);
  });

  it.each([-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid ended track version %s',
    trackVersion => {
      expect(parseLiveCommand({type: 'audio.next', trackVersion}).ok).toBe(
        false,
      );
    },
  );
});
