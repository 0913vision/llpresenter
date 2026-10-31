import {expect, it} from 'vitest';
import {createMessageId} from '../schema/ids';
import {liveMessages, messageTimeLeft} from './messagePlayback';

it('keeps indefinite messages and drops a timed message at its deadline', () => {
  const messageId = createMessageId('00000000-0000-4000-8000-000000000001');
  const timed = {
    messageId,
    text: 'Invented',
    targets: 'all' as const,
    excludedTargets: [],
    startedAt: 0,
    expiresAt: 1001,
  };
  const indefinite = {
    ...timed,
    messageId: createMessageId('00000000-0000-4000-8000-000000000002'),
    expiresAt: null,
  };
  const layer = {messageId, text: timed.text, items: [timed, indefinite]};
  expect(liveMessages(layer, 1000)).toEqual([timed, indefinite]);
  expect(liveMessages(layer, 1001)).toEqual([indefinite]);
  expect(messageTimeLeft(1001, 1000)).toBe('0:01');
  expect(messageTimeLeft(65_001, 0)).toBe('1:06');
  expect(messageTimeLeft(1, 1000)).toBe('0:00');
  expect(messageTimeLeft(null, 1000)).toBeUndefined();
});

it('retains a legacy message without inventing an expiry', () => {
  expect(liveMessages({messageId: 'legacy', text: 'Invented'}, 1000)).toEqual([
    {messageId: 'legacy', text: 'Invented', expiresAt: null},
  ]);
  expect(liveMessages(null, 1000)).toEqual([]);
});
