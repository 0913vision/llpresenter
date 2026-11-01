import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {
  createMediaId,
  createServiceItemId,
  parseMacroId,
} from '@core/schema/ids';
import type {ServiceItem} from '@core/schema/service';
import {MissingLiveTargetError} from '@main/live/commandErrors';
import type {LiveHistory} from '@main/live/history';
import type {SliceContext} from '@main/live/slice';
import {compileMacro} from '@main/macros/compiler';
import {MacroRunner, MAX_LOGGED_MACRO_PROBLEMS} from '@main/macros/runner';
import type {MacroPlan, MacroProblem} from '@main/macros/types';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {environment, IDS, macro, uuid} from '@fixtures/main/macros/testing';

vi.mock('@main/macros/compiler', () => ({compileMacro: vi.fn()}));

const MACRO = expectSuccess(parseMacroId(IDS.macro));
const ITEM = createServiceItemId(IDS.item);
const VIDEO = createMediaId(IDS.video);

function history(): LiveHistory {
  return {state: emptyLiveState(), undo: null};
}

function plan(problems: readonly MacroProblem[] = []): MacroPlan {
  return {
    macroId: MACRO,
    commands: [{type: 'layer.clear', target: 'slide'}],
    problems,
  };
}

function problem(reason: MacroProblem['reason']): MacroProblem {
  return {macroId: MACRO, action: 0, reason, message: reason};
}

function setup(items: readonly ServiceItem[] = [], macros = [macro()]) {
  const env = environment(macros);
  const supports = vi.fn(() => true);
  const runner = new MacroRunner({
    settings: env.settings,
    media: () => env.media,
    item: id => items.find(item => item.id === id),
    supports,
    log: env.log,
  });
  const effects: Array<() => void> = [];
  const applied = history();
  const context: SliceContext = {
    now: 0,
    defer: effect => effects.push(effect),
    ranMacro: vi.fn(),
    reject: vi.fn(),
    apply: vi.fn(() => applied),
  };
  const flush = () => {
    for (const effect of effects.splice(0)) effect();
  };
  vi.mocked(compileMacro).mockReturnValue(plan());
  return {...env, runner, context, flush, applied, supports};
}

describe('MacroRunner', () => {
  it('compiles the 매크로 against the state and applies its commands as one batch', () => {
    const {runner, context, applied, supports} = setup();
    const before = history();

    const next = runner.run(
      before,
      {type: 'macro.run', macroId: MACRO},
      context,
    );

    expect(context.ranMacro).toHaveBeenCalledExactlyOnceWith({
      macroId: MACRO,
      name: `Macro ${IDS.macro}`,
    });
    expect(compileMacro).toHaveBeenCalledWith(
      expect.objectContaining({state: before.state, supports}),
    );
    expect(context.apply).toHaveBeenCalledExactlyOnceWith(before, {
      type: 'live.batch',
      commands: [{type: 'layer.clear', target: 'slide'}],
    });
    expect(next.state).toEqual({...applied.state, lastMacroId: MACRO});
  });

  it('marks the last 매크로 with a new version when its commands change nothing', () => {
    const {runner, context} = setup();
    const before = history();
    vi.mocked(context.apply).mockReturnValue(before);

    const next = runner.run(
      before,
      {type: 'macro.run', macroId: MACRO},
      context,
    );

    expect(next.state.lastMacroId).toBe(MACRO);
    expect(next.state.version).toBe(before.state.version + 1);
  });

  it('keeps the last run only once the dispatch passes', () => {
    const {runner, context, flush} = setup();

    runner.run(history(), {type: 'macro.run', macroId: MACRO}, context);
    expect(runner.lastRun).toBeNull();

    flush();
    expect(runner.lastRun).toEqual(plan());
  });

  it('warns once about skipped actions with the count and a bounded list, leaving out unsupported commands', () => {
    const {runner, context, flush, log} = setup();
    const problems = [
      problem('unsupported-command'),
      ...Array.from({length: 12}, () => problem('missing-target')),
    ];
    vi.mocked(compileMacro).mockReturnValue(plan(problems));

    runner.run(history(), {type: 'macro.run', macroId: MACRO}, context);
    flush();

    expect(log.messages('warn')).toEqual(['skipped macro actions']);
    expect(log.entries[0]).toHaveProperty('detail.count', 12);
    expect(log.entries[0]).toHaveProperty(
      'detail.problems.length',
      MAX_LOGGED_MACRO_PROBLEMS,
    );
    expect(runner.lastRun?.problems).toHaveLength(13);
  });

  it('fails a 매크로 that does not exist as a missing target', () => {
    const {runner, context} = setup();
    const missing = expectSuccess(parseMacroId(uuid(99)));

    expect(() =>
      runner.run(history(), {type: 'macro.run', macroId: missing}, context),
    ).toThrow(MissingLiveTargetError);
    expect(context.apply).not.toHaveBeenCalled();
  });

  it('runs the start 매크로 of an item.start', () => {
    const {runner, context} = setup([
      {id: ITEM, media: VIDEO, macro: IDS.macro},
    ]);

    runner.run(history(), {type: 'item.start', itemId: ITEM}, context);

    expect(context.ranMacro).toHaveBeenCalledWith(
      expect.objectContaining({macroId: MACRO}),
    );
    expect(context.apply).toHaveBeenCalledOnce();
  });

  it('leaves the history alone for an item without a start 매크로', () => {
    const {runner, context} = setup([{id: ITEM, media: VIDEO}]);
    const before = history();

    expect(
      runner.run(before, {type: 'item.start', itemId: ITEM}, context),
    ).toBe(before);
    expect(context.apply).not.toHaveBeenCalled();
  });

  it('fails an item that is not in the service as a missing target', () => {
    const {runner, context} = setup();

    expect(() =>
      runner.run(history(), {type: 'item.start', itemId: ITEM}, context),
    ).toThrow(MissingLiveTargetError);
  });

  it('skips an item whose start 매크로 is not an ID and warns once the dispatch passes', () => {
    const {runner, context, flush, log} = setup([
      {id: ITEM, media: VIDEO, macro: 'invalid-id'},
    ]);
    const before = history();

    expect(
      runner.run(before, {type: 'item.start', itemId: ITEM}, context),
    ).toBe(before);
    expect(log.messages('warn')).toEqual([]);
    flush();
    expect(log.messages('warn')).toEqual(['skipped invalid item start macro']);
  });

  it('lists the startup 매크로 in file order', () => {
    const {runner} = setup(
      [],
      [
        macro(IDS.macro, [], {runOnStartup: true}),
        macro(uuid(21)),
        macro(uuid(22), [], {runOnStartup: true}),
      ],
    );

    expect(runner.startupIds()).toEqual([IDS.macro, uuid(22)]);
  });
});
