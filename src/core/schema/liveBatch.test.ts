import {describe, expect, it, vi} from 'vitest';
import {dispatchLogged, LiveStore} from '../../main/live/store';
import {SliceRegistry} from '../../main/live/sliceRegistry';
import {outputsSlice} from '../../main/live/slices/outputs';
import {interruptsSongOutput, isLiveCommand} from '../live/commands';
import {
  MAX_LIVE_BATCH_COMMANDS,
  parseLiveCommand,
  parseLiveCommandRequest,
} from './liveCommand';
import {expectSuccess} from './testHelpers';

const ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const first = {type: 'look.set', lookId: ID};
const second = {type: 'timer.start', timerId: ID};

describe('live batch contracts', () => {
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
    expect(isLiveCommand(value)).toBe(true);
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
    expect(isLiveCommand(request)).toBe(false);
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

  it('uses strict validation for standalone commands', () => {
    expect(expectSuccess(parseLiveCommandRequest(first))).toEqual({
      command: first,
      rejected: [],
    });
    expect(parseLiveCommandRequest({type: 'timer.start'}).ok).toBe(false);
  });

  it('does not dispatch batch children when its registry has no transaction slice', () => {
    const registry = new SliceRegistry([outputsSlice]);
    const store = new LiveStore(undefined, undefined, registry);
    const command = expectSuccess(
      parseLiveCommand({
        type: 'live.batch',
        commands: [{type: 'output.set', screenId: 'main', on: true}],
      }),
    );
    const state = store.state;
    const log = {info: vi.fn(), warn: vi.fn(), error: vi.fn(), flush: vi.fn()};
    expect(interruptsSongOutput(command)).toBe(false);
    dispatchLogged(store, command, log);
    expect(store.state).toBe(state);
    expect(log.warn).toHaveBeenCalledExactlyOnceWith('unhandled live command', {
      type: 'live.batch',
    });
  });
});
