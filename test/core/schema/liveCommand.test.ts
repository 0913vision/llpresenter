import {describe, expect, it} from 'vitest';
import {
  parseLiveCommand,
  parseLiveCommandRequest,
  MAX_LIVE_BATCH_COMMANDS,
} from '@core/schema/liveCommand';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

describe('parseLiveCommand', () => {
  it('accepts the black screen toggle command', () => {
    expect(parseLiveCommand({type: 'black.toggle'})).toEqual({
      ok: true,
      value: {type: 'black.toggle'},
    });
  });

  it('drops fields a command does not have, such as a start time', () => {
    expect(
      parseLiveCommand({
        type: 'media.show',
        media: {mediaId: 'warm-light', loop: true, startedAt: 5},
        sender: 'control',
      }),
    ).toEqual({
      ok: true,
      value: {type: 'media.show', media: {mediaId: 'warm-light', loop: true}},
    });
  });

  it('rejects an array or an object whose fields are inherited', () => {
    const arrayCommand = Object.assign([], {type: 'clear.undo'});
    const inherited: unknown = Object.create({type: 'clear.undo'});

    expect(parseLiveCommand(arrayCommand).ok).toBe(false);
    expect(parseLiveCommand(inherited).ok).toBe(false);
  });

  it('rejects a layer that is an array with the right fields', () => {
    const media = Object.assign([], {mediaId: 'warm-light', loop: true});

    const result = parseLiveCommand({type: 'media.show', media});

    expect(result.ok ? undefined : result.error.field).toBe('media');
  });

  it('rejects values that are not commands', () => {
    for (const value of [null, undefined, 'clear.undo', [], 3]) {
      expect(parseLiveCommand(value).ok).toBe(false);
    }
  });
});

describe('parseLiveCommandRequest', () => {
  it('keeps the valid children of a batch and names each skipped one', () => {
    const child = {type: 'audio.pause'};
    const parsed = parseLiveCommandRequest({
      type: 'live.batch',
      commands: [child, {type: 'unknown'}, {type: 'timer.start'}],
    });
    expect(parsed.ok && parsed.value.command).toEqual({
      type: 'live.batch',
      commands: [child],
    });
    expect(parsed.ok && parsed.value.rejected.map(({field}) => field)).toEqual([
      'commands.1.type',
      'commands.2.timerId',
    ]);
  });

  it('passes a single valid command with nothing rejected', () => {
    const command = {type: 'clear.undo'};
    expect(parseLiveCommandRequest(command)).toEqual({
      ok: true,
      value: {command, rejected: []},
    });
  });

  it('refuses a single malformed command as a whole', () => {
    expect(parseLiveCommandRequest({type: 'audio.play', source: []}).ok).toBe(
      false,
    );
  });
});

describe('live batch requests', () => {
  const ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
  const first = {type: 'theme.set', themeId: ID};
  const second = {type: 'timer.start', timerId: ID};

  it('accepts bounded flat batches, strips fields, and preserves order', () => {
    const value = {type: 'live.batch', commands: [first, second]};
    expect(
      expectSuccess(
        parseLiveCommand({
          ...value,
          extra: true,
          commands: [{...first, extra: true}, second],
        }),
      ),
    ).toEqual(value);
    for (const commands of [
      [],
      Array.from({length: MAX_LIVE_BATCH_COMMANDS}, () => first),
    ]) {
      expect(parseLiveCommand({type: 'live.batch', commands}).ok).toBe(true);
    }
  });

  it('keeps valid children and returns indexed errors for bad children', () => {
    const request = {
      type: 'live.batch',
      commands: [
        first,
        {type: 'timer.start', timerId: 'broken'},
        {type: 'unknown'},
        {type: 'live.batch', commands: [second]},
        second,
      ],
    };
    expect(parseLiveCommand(request).ok).toBe(false);
    const parsed = expectSuccess(parseLiveCommandRequest(request));
    expect(parsed.command).toEqual({
      type: 'live.batch',
      commands: [first, second],
    });
    expect(parsed.rejected.map(({field}) => field)).toEqual([
      'commands.1.timerId',
      'commands.2.type',
      'commands.3.type',
    ]);
    expect(parseLiveCommand(parsed.command).ok).toBe(true);
  });

  it('rejects malformed envelopes and excessive batches before reading children', () => {
    for (const value of [
      {type: 'live.batch'},
      {type: 'live.batch', commands: {}},
      {
        type: 'live.batch',
        commands: Array(MAX_LIVE_BATCH_COMMANDS + 1).fill(first),
      },
      Object.assign([], {type: 'live.batch', commands: []}),
    ]) {
      expect(parseLiveCommand(value).ok).toBe(false);
      expect(parseLiveCommandRequest(value).ok).toBe(false);
    }
  });

  it('reports sparse and entirely invalid children without inventing actions', () => {
    const commands: unknown[] = [];
    commands[1] = null;
    const result = expectSuccess(
      parseLiveCommandRequest({type: 'live.batch', commands}),
    );
    expect(result.command).toEqual({type: 'live.batch', commands: []});
    expect(result.rejected.map(({field}) => field)).toEqual([
      'commands.0',
      'commands.1',
    ]);
  });
});
