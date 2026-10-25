import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import {parseService} from '@shared/schema/service';
import {LiveStore, dispatchLogged} from '../live/store';
import {SliceRegistry} from '../live/sliceRegistry';
import {batchSlice} from '../live/slices/batch';
import {clearSlice} from '../live/slices/clear';
import {contentSlice} from '../live/slices/content';
import {macrosSlice} from '../live/slices/macros';
import {propsSlice} from '../live/slices/props';
import {MacroRunner} from './runner';
import type {MacroCommandPort} from './types';
import {environment, findMacro, IDS, macro, uuid} from './testing';

function harness(actions: readonly object[], items: readonly object[] = []) {
  const env = environment([macro(IDS.macro, actions)]);
  const service = parseService(
    JSON.stringify({
      format: 'llservice',
      schemaVersion: 1,
      id: IDS.service,
      name: 'Test',
      date: '2026-10-26T10:00',
      order: items,
    }),
    'service.llservice',
  );
  if (!service.ok) throw new Error(service.error.message);
  const store = new LiveStore(
    undefined,
    () => 100,
    new SliceRegistry([
      batchSlice,
      clearSlice,
      contentSlice,
      macrosSlice,
      propsSlice,
    ]),
  );
  const releaseSettings = store.connectSettings(env.settings);
  const runner = new MacroRunner({
    settings: env.settings,
    media: () => env.media,
    item: id => service.value.data.order.find(item => item.id === id),
    supports: type => store.handles(type),
    log: env.log,
  });
  const release = store.connectMacros(runner);
  onTestFinished(() => {
    release();
    releaseSettings();
  });
  const id = findMacro(env.catalog).id;
  return {...env, store, runner, id};
}

describe('macro live execution', () => {
  it.each([uuid(99), 'invalid-id'])(
    'reports a missing or invalid item macro %s without changing output',
    macroId => {
      const {store, log} = harness(
        [],
        [{id: IDS.item, media: IDS.video, macro: macroId}],
      );
      const command = parseLiveCommand({type: 'item.start', itemId: IDS.item});
      if (!command.ok) throw new Error(command.error.message);
      const before = store.state;
      dispatchLogged(store, command.value, log);
      expect(store.state).toBe(before);
      expect(log.entries).toHaveLength(1);
      expect(log.entries[0]).toHaveProperty(
        'message',
        macroId === 'invalid-id'
          ? 'live command failed'
          : 'skipped live command',
      );
    },
  );
  it('skips a deleted Look and applies three clears as one batch with one notification and one undo', () => {
    const {store, runner, log, id} = harness([
      {kind: 'look', look: uuid(99)},
      {kind: 'clearLayer', layer: 'slide'},
      {kind: 'clearLayer', layer: 'media'},
      {kind: 'clearLayer', layer: 'message'},
    ]);
    store.dispatch({
      type: 'slide.show',
      slide: {
        itemId: 'item',
        position: 0,
        label: null,
        lines: ['Invented slide'],
      },
    });
    store.dispatch({
      type: 'media.show',
      media: {mediaId: IDS.video, loop: true},
    });
    store.dispatch({
      type: 'message.show',
      message: {messageId: 'message', text: 'Invented notice'},
    });
    const before = store.state;
    const listener = vi.fn();
    onTestFinished(store.subscribe(listener));
    const batch = vi.spyOn(batchSlice, 'apply');
    onTestFinished(() => batch.mockRestore());
    dispatchLogged(store, {type: 'macro.run', macroId: id}, log);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0]?.[1]).toEqual({
      type: 'live.batch',
      commands: runner.lastRun?.commands,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.state.version).toBe(before.version + 1);
    expect(store.state.layers).toMatchObject({
      slide: null,
      media: null,
      message: null,
    });
    const problem = log.entries.find(
      entry => entry.message === 'skipped macro action',
    );
    expect(problem).toHaveProperty('detail.reason', 'missing-target');
    expect(problem).toHaveProperty('detail.target', {
      kind: 'look',
      id: uuid(99),
    });
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers).toEqual(before.layers);
  });

  it('executes item.start before the following slide inside the same outer transaction', () => {
    const {store, log} = harness(
      [{kind: 'clearLayer', layer: 'media'}],
      [{id: IDS.item, media: IDS.video, macro: IDS.macro}],
    );
    store.dispatch({
      type: 'media.show',
      media: {mediaId: IDS.video, loop: true},
    });
    const parsed = parseLiveCommand({
      type: 'live.batch',
      commands: [
        {type: 'item.start', itemId: IDS.item},
        {
          type: 'slide.show',
          slide: {
            itemId: IDS.item,
            position: 0,
            label: null,
            lines: ['After start'],
          },
        },
      ],
    });
    if (!parsed.ok) throw new Error(parsed.error.message);
    const listener = vi.fn();
    onTestFinished(store.subscribe(listener));
    dispatchLogged(store, parsed.value, log);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.state.layers.media).toBeNull();
    expect(store.state.layers.slide?.lines).toEqual(['After start']);
  });

  it('treats an item without a macro as a no-op and reports an unknown item as missing-target', () => {
    const {store, log} = harness([], [{id: IDS.item, media: IDS.video}]);
    for (const itemId of [IDS.item, uuid(31)]) {
      const parsed = parseLiveCommand({type: 'item.start', itemId});
      if (!parsed.ok) throw new Error(parsed.error.message);
      dispatchLogged(store, parsed.value, log);
    }
    expect(store.state.version).toBe(0);
    expect(log.entries).toContainEqual(
      expect.objectContaining({
        message: 'skipped live command',
        detail: {
          type: 'item.start',
          reason: 'missing-target',
          target: {kind: 'service-item', id: uuid(31)},
        },
      }),
    );
  });

  it('retains unsupported commands for the explicit test registry and executes the remaining actions', () => {
    const {store, runner, log, id} = harness([
      {kind: 'look', look: IDS.look},
      {kind: 'clearAll'},
    ]);
    store.dispatch({
      type: 'slide.show',
      slide: {itemId: 'item', position: 0, label: null, lines: ['Before']},
    });
    dispatchLogged(store, {type: 'macro.run', macroId: id}, log);
    expect(runner.lastRun?.problems[0]?.reason).toBe('unsupported-command');
    expect(store.state.layers.slide).toBeNull();
    expect(log.messages('warn')).toEqual(['unhandled live command']);
  });

  it('releases only the matching runtime connection and rejects execution after it is removed', () => {
    const {store, log, id} = harness([]);
    const first = {run: vi.fn<MacroCommandPort['run']>(history => history)};
    const second = {run: vi.fn<MacroCommandPort['run']>(history => history)};
    const removeFirst = store.connectMacros(first);
    const removeSecond = store.connectMacros(second);
    removeFirst();
    dispatchLogged(store, {type: 'macro.run', macroId: id}, log);
    expect(first.run).not.toHaveBeenCalled();
    expect(second.run).toHaveBeenCalledOnce();
    removeSecond();
    dispatchLogged(store, {type: 'macro.run', macroId: id}, log);
    expect(second.run).toHaveBeenCalledOnce();
    expect(log.messages('warn')).toEqual(['skipped live command']);
  });
});
