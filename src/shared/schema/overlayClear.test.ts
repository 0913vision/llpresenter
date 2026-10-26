import {expect, it} from 'vitest';
import {interruptsSongOutput} from '../commands';
import {parseLiveCommand, parseLiveCommandRequest} from './liveCommand';

const ID = '00000000-0000-4000-8000-000000000001';
it.each([
  {kind: 'message', messageId: ID},
  {kind: 'prop', propId: ID},
  {kind: 'stage-message'},
])('accepts one bounded target %j, including in a batch', target => {
  const command = {type: 'overlay.clear', target};
  const parsed = parseLiveCommand(command);
  expect(parsed).toEqual({ok: true, value: command});
  if (!parsed.ok) throw new Error('Invalid fixture');
  expect(interruptsSongOutput(parsed.value)).toBe(false);
  expect(parseLiveCommand({type: 'live.batch', commands: [command]}).ok).toBe(
    true,
  );
});

it.each([
  undefined,
  null,
  [],
  {},
  {kind: 'clock'},
  {kind: 'message'},
  {kind: 'message', messageId: ''},
  {kind: 'message', messageId: 1},
  {kind: 'message', messageId: '0'.repeat(37)},
  {kind: 'message', messageId: '00000000-0000-4000-8000-00000000000A'},
  {kind: 'message', messageId: '00000000-0000-1000-8000-000000000001'},
  {kind: 'prop', propId: 'prop'},
  {kind: 'prop', messageId: ID},
])('rejects malformed targets %j', target => {
  expect(parseLiveCommand({type: 'overlay.clear', target}).ok).toBe(false);
});

it('drops unknown fields and refuses inherited targets', () => {
  expect(
    parseLiveCommand({
      type: 'overlay.clear',
      target: {kind: 'stage-message', extra: 1},
      sender: 'control',
    }),
  ).toEqual({
    ok: true,
    value: {type: 'overlay.clear', target: {kind: 'stage-message'}},
  });
  const inherited: unknown = Object.create({kind: 'stage-message'});
  expect(parseLiveCommand({type: 'overlay.clear', target: inherited}).ok).toBe(
    false,
  );
});

it('skips one invalid batch child and preserves the next clear', () => {
  expect(
    parseLiveCommandRequest({
      type: 'live.batch',
      commands: [
        {
          type: 'overlay.clear',
          target: {kind: 'message', messageId: 'missing'},
        },
        {type: 'overlay.clear', target: {kind: 'stage-message'}},
      ],
    }),
  ).toMatchObject({
    ok: true,
    value: {
      command: {
        commands: [{type: 'overlay.clear', target: {kind: 'stage-message'}}],
      },
      rejected: [{field: 'commands.0.target.messageId'}],
    },
  });
});
