import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {vi} from 'vitest';
import {macroActionKinds} from '@core/schema/macros';
import {parseLiveState} from '@core/schema/liveState';
import {compileMacro, MACRO_EXECUTION_LIMITS} from './compiler';
import {defineMacroAction, MacroActionRegistry} from './actionRegistry';
import {macroActionHandlers} from './actions';
import {environment, findMacro, IDS, macro, uuid} from './testing';

describe('macro compiler', () => {
  it('stops expansion once the command budget is reached and reports it once', () => {
    const compile = vi.fn(() => ({
      kind: 'commands' as const,
      commands: Array.from({length: 257}, () => ({
        type: 'layer.clear' as const,
        target: 'all' as const,
      })),
    }));
    const registry = new MacroActionRegistry([
      defineMacroAction({kind: 'clearAll', compile}),
    ]);
    const {catalog} = environment([
      macro(IDS.macro, [{kind: 'clearAll'}, {kind: 'clearAll'}]),
    ]);
    const plan = compileMacro(
      {
        catalog,
        macro: findMacro(catalog),
        state: emptyLiveState(),
        supports: () => true,
      },
      registry,
    );
    expect(plan.commands).toHaveLength(256);
    expect(plan.problems.map(problem => problem.reason)).toEqual([
      'command-limit',
    ]);
    expect(compile).toHaveBeenCalledOnce();
  });
  it('does not project a rejected prop activation into a later toggle after a clear', () => {
    const props = Array.from({length: 65}, (_, index) => ({
      id: uuid(100 + index),
      name: 'Prop',
      content: {kind: 'image', media: IDS.image},
      targets: [IDS.main],
    }));
    const {catalog} = environment(
      [
        macro(IDS.macro, [
          {kind: 'prop', prop: uuid(164), mode: 'toggle'},
          {kind: 'clearLayer', prop: uuid(100)},
          {kind: 'prop', prop: uuid(164), mode: 'toggle'},
        ]),
      ],
      {props: {props}},
    );
    const empty = emptyLiveState();
    const parsed = parseLiveState({
      ...empty,
      layers: {
        ...empty.layers,
        prop: {
          propId: uuid(100),
          items: props.slice(0, 64).map(prop => ({
            propId: prop.id,
            content: prop.content,
            targets: prop.targets,
          })),
        },
      },
    });
    if (!parsed.ok) throw new Error(parsed.error.message);
    const plan = compileMacro({
      catalog,
      macro: findMacro(catalog),
      state: parsed.value,
      supports: () => true,
    });
    expect(plan.commands).toEqual([
      {type: 'overlay.clear', target: {kind: 'prop', propId: uuid(100)}},
      {type: 'prop.set', propId: uuid(164), on: true},
    ]);
    expect(plan.problems[0]?.reason).toBe('invalid-action');
    expect(parsed.value.layers.prop?.items).toHaveLength(64);
  });
  it('maps every registered kind in source order, including message blanks and audio transport', () => {
    expect(macroActionHandlers.map(handler => handler.kind).sort()).toEqual(
      [...macroActionKinds].sort(),
    );
    const actions = [
      {kind: 'look', look: IDS.look},
      {kind: 'stageLayout', layout: IDS.layout, screen: IDS.stage},
      {kind: 'media', media: IDS.video},
      {kind: 'prop', prop: IDS.prop},
      {
        kind: 'message',
        template: IDS.message,
        values: {name: 'value'},
        targets: [IDS.main],
        duration: 5,
      },
      {kind: 'notice', notice: IDS.notice},
      {kind: 'audio', operation: 'play', media: IDS.audio},
      {kind: 'audio', operation: 'fadeOut'},
      {kind: 'audio', operation: 'stop'},
      {kind: 'audioPlaylist', playlist: IDS.playlist},
      {kind: 'timer', timer: IDS.timer, operation: 'pause'},
      {kind: 'timer', timer: IDS.timer, operation: 'reset'},
      {kind: 'clearLayer', prop: IDS.prop},
      {kind: 'clearAll'},
    ];
    const {catalog} = environment([macro(IDS.macro, actions)]);
    const plan = compileMacro({
      catalog,
      macro: findMacro(catalog),
      state: emptyLiveState(),
      supports: () => true,
    });
    expect(plan.problems).toEqual([]);
    expect(plan.commands).toEqual([
      {type: 'look.set', lookId: IDS.look},
      {type: 'stage.layout.set', layoutId: IDS.layout, screenId: IDS.stage},
      {type: 'media.show', media: {mediaId: IDS.video, loop: true}},
      {type: 'prop.set', propId: IDS.prop, on: true},
      {
        type: 'message.send',
        text: 'Invented value',
        targets: [IDS.main],
        duration: 5,
      },
      {type: 'notice.start', noticeId: IDS.notice},
      {type: 'audio.play', source: {kind: 'media', mediaId: IDS.audio}},
      {type: 'audio.fadeOut'},
      {type: 'layer.clear', target: 'audio'},
      {
        type: 'audio.play',
        source: {kind: 'playlist', playlistId: IDS.playlist, position: 0},
      },
      {type: 'timer.pause', timerId: IDS.timer},
      {type: 'timer.reset', timerId: IDS.timer},
      {type: 'overlay.clear', target: {kind: 'prop', propId: IDS.prop}},
      {type: 'layer.clear', target: 'all'},
    ]);
  });

  it.each([
    {kind: 'look', look: uuid(99)},
    {kind: 'stageLayout', layout: uuid(99)},
    {kind: 'stageLayout', layout: IDS.layout, screen: uuid(99)},
    {kind: 'media', media: uuid(99)},
    {kind: 'prop', prop: uuid(99)},
    {kind: 'clearLayer', prop: uuid(99)},
    {
      kind: 'message',
      template: uuid(99),
      values: {},
      targets: 'all',
      duration: null,
    },
    {
      kind: 'message',
      template: IDS.message,
      values: {name: 'value'},
      targets: [uuid(99)],
      duration: null,
    },
    {kind: 'notice', notice: uuid(99)},
    {kind: 'audio', operation: 'play', media: uuid(99)},
    {kind: 'audioPlaylist', playlist: uuid(99)},
    {kind: 'timer', timer: uuid(99)},
    {kind: 'macro', macro: uuid(99)},
  ])('reports missing target for %j and retains the next action', action => {
    const {catalog} = environment([
      macro(IDS.macro, [action, {kind: 'clearAll'}]),
    ]);
    const plan = compileMacro({
      catalog,
      macro: findMacro(catalog),
      state: emptyLiveState(),
      supports: () => true,
    });
    expect(plan.commands).toEqual([{type: 'layer.clear', target: 'all'}]);
    expect(plan.problems).toEqual([
      expect.objectContaining({
        reason: 'missing-target',
        macroId: IDS.macro,
        action: 0,
      }),
    ]);
  });

  it('flattens nested runs in place, skips cycles immediately, and allows a sibling to run the same macro again', () => {
    const nested = uuid(21);
    const {catalog} = environment([
      macro(IDS.macro, [
        {kind: 'macro', macro: nested},
        {kind: 'macro', macro: nested},
      ]),
      macro(nested, [
        {kind: 'clearLayer', layer: 'slide'},
        {kind: 'macro', macro: IDS.macro},
        {kind: 'clearLayer', layer: 'media'},
      ]),
    ]);
    const plan = compileMacro({
      catalog,
      macro: findMacro(catalog),
      state: emptyLiveState(),
      supports: () => true,
    });
    expect(
      plan.commands.map(command =>
        command.type === 'layer.clear' ? command.target : '',
      ),
    ).toEqual(['slide', 'media', 'slide', 'media']);
    expect(plan.problems.map(problem => problem.reason)).toEqual([
      'cycle',
      'cycle',
    ]);
  });

  it('stops a self run and keeps the remaining actions', () => {
    const {catalog} = environment([
      macro(IDS.macro, [{kind: 'macro', macro: IDS.macro}, {kind: 'clearAll'}]),
    ]);
    const plan = compileMacro({
      catalog,
      macro: findMacro(catalog),
      state: emptyLiveState(),
      supports: () => true,
    });
    expect(plan.commands).toEqual([{type: 'layer.clear', target: 'all'}]);
    expect(plan.problems[0]?.reason).toBe('cycle');
  });

  it('permits four distinct macro frames and refuses the fifth', () => {
    const macros = Array.from({length: 5}, (_, index) =>
      macro(uuid(20 + index), [
        {kind: 'clearLayer', layer: 'slide'},
        ...(index === 4 ? [] : [{kind: 'macro', macro: uuid(21 + index)}]),
      ]),
    );
    const {catalog} = environment(macros);
    const plan = compileMacro({
      catalog,
      macro: findMacro(catalog),
      state: emptyLiveState(),
      supports: () => true,
    });
    expect(plan.commands).toHaveLength(4);
    expect(plan.problems[0]?.reason).toBe('depth-limit');
  });

  it('bounds repeated expansion and skips unknown or invalid actions without losing later actions', () => {
    const child = uuid(21);
    const {catalog} = environment([
      macro(
        IDS.macro,
        Array.from({length: 256}, () => ({kind: 'macro', macro: child})),
      ),
      macro(child, [{kind: 'clearAll'}]),
    ]);
    const plan = compileMacro({
      catalog,
      macro: findMacro(catalog),
      state: emptyLiveState(),
      supports: () => true,
    });
    expect(plan.commands.length).toBeLessThanOrEqual(
      MACRO_EXECUTION_LIMITS.actions,
    );
    expect(plan.problems.at(-1)?.reason).toBe('action-limit');
    const another = environment([
      macro(IDS.macro, [
        {kind: 'future-action', data: true},
        {
          kind: 'message',
          template: IDS.message,
          values: {},
          targets: 'all',
          duration: null,
        },
        {kind: 'clearAll'},
      ]),
    ]);
    const continued = compileMacro({
      catalog: another.catalog,
      macro: findMacro(another.catalog),
      state: emptyLiveState(),
      supports: () => true,
    });
    expect(continued.commands).toEqual([{type: 'layer.clear', target: 'all'}]);
    expect(continued.problems.map(problem => problem.reason)).toEqual([
      'unknown-action',
      'invalid-action',
    ]);
  });

  it('projects prop toggles across earlier toggles and clears without mutating live state', () => {
    const {catalog} = environment([
      macro(IDS.macro, [
        {kind: 'prop', prop: IDS.prop, mode: 'toggle'},
        {kind: 'prop', prop: IDS.prop, mode: 'toggle'},
        {kind: 'prop', prop: IDS.prop, mode: 'on'},
        {kind: 'clearAll'},
        {kind: 'prop', prop: IDS.prop, mode: 'toggle'},
      ]),
    ]);
    const state = emptyLiveState();
    const plan = compileMacro({
      catalog,
      macro: findMacro(catalog),
      state,
      supports: () => true,
    });
    expect(
      plan.commands
        .filter(command => command.type === 'prop.set')
        .map(command => command.on),
    ).toEqual([true, false, true, true]);
    expect(state.layers.prop).toBeNull();
    expect(parseLiveState(state).ok).toBe(true);
  });

  it('uses an explicit action registry for unavailable handlers and rejects duplicate registrations', () => {
    const handler = defineMacroAction({
      kind: 'clearAll',
      compile: () => ({
        kind: 'commands',
        commands: [{type: 'layer.clear', target: 'all'}],
      }),
    });
    expect(() => new MacroActionRegistry([handler, handler])).toThrow(
      'Two macro handlers',
    );
    const {catalog} = environment([macro(IDS.macro, [{kind: 'clearAll'}])]);
    const plan = compileMacro(
      {
        catalog,
        macro: findMacro(catalog),
        state: emptyLiveState(),
        supports: () => false,
      },
      new MacroActionRegistry([]),
    );
    expect(plan.commands).toEqual([]);
    expect(plan.problems[0]?.reason).toBe('unknown-action');
  });
});
