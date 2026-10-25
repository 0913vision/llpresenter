import {describe, expect, it, vi} from 'vitest';
import {dispatchLogged, LiveStore} from '../../main/live/store';
import {interruptsSongOutput} from '../commands';
import {parseLiveCommand, parseLiveCommandRequest} from './liveCommand';
import {expectSuccess} from './testHelpers';

const ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const screen = {id: ID, name: 'Audience', kind: 'audience', method: 'capture'};
const commands = [
  {type: 'screen.testPattern.set', screenId: ID, on: true},
  {type: 'screen.testPattern.set', screenId: ID, on: false},
  {type: 'monitors.identify'},
  {type: 'screen.settings.apply', screen},
];

describe('screen command contracts', () => {
  it.each(commands)(
    'accepts $type without applying an unsupported slice',
    value => {
      const command = expectSuccess(parseLiveCommand(value));
      expect(command).toEqual(value);
      expect(interruptsSongOutput(command)).toBe(false);
      const store = new LiveStore();
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

  it('preserves future configuration fields through both boundary parsers', () => {
    const future: unknown = JSON.parse(
      '{"__proto__":{"safe":true},"nested":{"constructor":"future"}}',
    );
    const value = {
      type: 'screen.settings.apply',
      screen: {...screen, future, edgeMargin: 3, offset: {x: -2.5, y: 4}},
    };
    expect(expectSuccess(parseLiveCommand(value))).toEqual(value);
    expect(expectSuccess(parseLiveCommandRequest(value)).command).toEqual(
      value,
    );
    expect(
      expectSuccess(
        parseLiveCommandRequest({type: 'live.batch', commands: [value]}),
      ).command,
    ).toEqual({type: 'live.batch', commands: [value]});
  });

  it.each([
    {type: 'screen.testPattern.set', screenId: 'main', on: true},
    {type: 'screen.testPattern.set', screenId: ID, on: 'yes'},
    {type: 'screen.testPattern.set', screenId: ID},
    {type: 'screen.settings.apply', screen: {...screen, method: 'remote'}},
    {type: 'screen.settings.apply', screen: {...screen, edgeMargin: 101}},
    {
      type: 'screen.settings.apply',
      screen: {...screen, offset: {x: Infinity, y: 0}},
    },
    {
      type: 'screen.settings.apply',
      screen: {...screen, resolution: {width: 0, height: 1080}},
    },
    {type: 'screen.settings.apply', screen: Object.assign([], screen)},
  ])('rejects malformed screen command %j', value => {
    expect(parseLiveCommand(value).ok).toBe(false);
  });
});
