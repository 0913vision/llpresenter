import {describe, expect, expectTypeOf, it, vi} from 'vitest';
import {dispatchLogged, LiveStore} from '../../main/live/store';
import {SliceRegistry} from '../../main/live/sliceRegistry';
import {interruptsSongOutput} from '../commands';
import type {ScreenId} from './ids';
import {parseLiveCommand, parseLiveCommandRequest} from './liveCommand';
import type {ScreenCommand} from './screenCommands';
import {expectSuccess} from './testHelpers';

const ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const screen = {id: ID, name: 'Audience', kind: 'audience', method: 'capture'};
const commands = [
  {type: 'screen.testPattern.set', screenId: ID, on: true},
  {type: 'screen.testPattern.set', screenId: ID, on: false},
  {type: 'monitors.identify'},
  {type: 'screen.settings.apply', screenId: ID},
];

describe('screen command contracts', () => {
  it.each(commands)(
    'accepts $type and rejects it when absent from the test registry',
    value => {
      const command = expectSuccess(parseLiveCommand(value));
      expect(command).toEqual(value);
      expect(interruptsSongOutput(command)).toBe(false);
      const store = new LiveStore(undefined, undefined, new SliceRegistry([]));
      const state = store.state;
      const log = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        flush: vi.fn(),
      };
      dispatchLogged(store, command, log);
      expect(store.state).toBe(state);
      expect(log.warn).toHaveBeenCalledExactlyOnceWith(
        'unhandled live command',
        {type: command.type},
      );
    },
  );

  it('keeps only the saved screen ID through both boundary parsers and batches', () => {
    const command = {type: 'screen.settings.apply', screenId: ID};
    const value = {
      ...command,
      screen: {...screen, name: 'Uncommitted name', edgeMargin: 3},
      extra: true,
    };
    expect(expectSuccess(parseLiveCommand(value))).toEqual(command);
    expect(expectSuccess(parseLiveCommandRequest(value)).command).toEqual(
      command,
    );
    expect(
      expectSuccess(
        parseLiveCommandRequest({type: 'live.batch', commands: [value]}),
      ).command,
    ).toEqual({type: 'live.batch', commands: [command]});
    expectTypeOf<
      Extract<ScreenCommand, {type: 'screen.settings.apply'}>['screenId']
    >().toEqualTypeOf<ScreenId>();
  });

  it.each([
    {type: 'screen.testPattern.set', screenId: 'main', on: true},
    {type: 'screen.testPattern.set', screenId: ID, on: 'yes'},
    {type: 'screen.testPattern.set', screenId: ID},
    {type: 'screen.settings.apply'},
    {type: 'screen.settings.apply', screen},
    {type: 'screen.settings.apply', screenId: ''},
    {type: 'screen.settings.apply', screenId: 'main'},
    {type: 'screen.settings.apply', screenId: 1},
    {type: 'screen.settings.apply', screenId: [ID]},
    {type: 'screen.settings.apply', screenId: ID.toUpperCase()},
  ])('rejects malformed screen command %j', value => {
    expect(parseLiveCommand(value).ok).toBe(false);
  });
});
