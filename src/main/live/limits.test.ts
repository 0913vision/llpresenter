import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@shared/live';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import {parseLiveState} from '@shared/schema/liveState';
import {
  LIVE_STATE_LIMITS,
  LIVE_OUTPUT_ALIASES,
} from '@shared/schema/liveLimits';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import {defaultPreferences} from '@shared/schema/preferences';
import {MAX_ACTIVE_MESSAGES} from '@shared/schema/overlayState';
import {serializeRecoveryRecord} from '@shared/schema/recoveryRecord';
import {expectSuccess} from '@shared/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import {settingsDefaults} from '../store/settingsDefaults';
import {LiveStore, dispatchLogged} from './store';
import {SliceRegistry} from './sliceRegistry';
import {batchSlice} from './slices/batch';
import {outputsSlice} from './slices/outputs';
import {contentSlice} from './slices/content';
import {propsSlice} from './slices/props';
import {macrosSlice} from './slices/macros';
import {screenSettingsSlice} from './slices/screenSettings';
import * as budget from './stateBudget';
import * as liveSchema from '@shared/schema/liveState';
import type {MacroCommandPort, ScreenSettingsPort} from './slice';
import {MissingLiveTargetError} from './commandErrors';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const registry = () =>
  new SliceRegistry([batchSlice, outputsSlice, contentSlice, propsSlice]);
function screenSettingsPort(
  requireSaved: ScreenSettingsPort['requireSaved'] = () => undefined,
) {
  return {
    requireSaved: vi.fn(requireSaved),
    queueRefresh: vi.fn<ScreenSettingsPort['queueRefresh']>(),
  };
}
function canSave(state: LiveState) {
  return serializeRecoveryRecord({
    format: 'llrecovery',
    schemaVersion: 1,
    savedAt: '2026-10-26T00:00:00.000Z',
    serviceId: null,
    state,
  }).ok;
}

describe('live admission limits', () => {
  it('rejects the whole dispatch after a missing resync target and queues no refresh', () => {
    const outputs = Object.fromEntries(
      Array.from({length: LIVE_STATE_LIMITS.outputs}, (_, i) => [
        uuid(i),
        true,
      ]),
    );
    const store = new LiveStore(
      {...emptyLiveState(), outputs},
      () => 0,
      new SliceRegistry([outputsSlice, batchSlice, screenSettingsSlice]),
    );
    const screens = screenSettingsPort(() => {
      throw new MissingLiveTargetError({kind: 'screen', id: uuid(999)});
    });
    const release = store.connectScreenSettings(screens);
    const log = recordingLogger();
    const before = store.state;
    dispatchLogged(
      store,
      expectSuccess(
        parseLiveCommand({
          type: 'live.batch',
          commands: [
            {type: 'screen.settings.apply', screenId: uuid(999)},
            {type: 'output.set', screenId: uuid(999), on: true},
          ],
        }),
      ),
      log,
    );
    expect(screens.requireSaved).toHaveBeenCalledExactlyOnceWith(uuid(999));
    expect(screens.queueRefresh).not.toHaveBeenCalled();
    expect(store.state).toBe(before);
    expect(log.messages('warn')).toHaveLength(2);
    expect(log.messages('error')).toEqual([]);
    release();
  });

  it('retains admitted output and reports a deferred observer failure', () => {
    const store = new LiveStore(
      undefined,
      () => 0,
      new SliceRegistry([outputsSlice, batchSlice, macrosSlice]),
    );
    const release = store.connectMacros({
      run: (history, _command, context) => {
        context.defer(() => {
          throw new Error('Observer failed');
        });
        return context.apply(history, {
          type: 'output.set',
          screenId: 'main',
          on: true,
        });
      },
    });
    const log = recordingLogger();
    dispatchLogged(
      store,
      expectSuccess(parseLiveCommand({type: 'macro.run', macroId: uuid(9)})),
      log,
    );
    expect(store.state.outputs['main']).toBe(true);
    expect(log.messages('error')).toEqual(['live command failed']);
    release();
  });
  it('checks one selected state and byte budget for a 256-child batch nested inside a macro', () => {
    const store = new LiveStore(
      undefined,
      () => 0,
      new SliceRegistry([outputsSlice, batchSlice, macrosSlice]),
    );
    const release = store.connectMacros({
      run: (history, _command, context) =>
        context.apply(history, {
          type: 'live.batch',
          commands: Array.from({length: 256}, (_, index) => ({
            type: 'output.set',
            screenId: 'main',
            on: index % 2 === 0,
          })),
        }),
    });
    const size = vi.spyOn(budget, 'fitsLiveStateByteBudget');
    const shape = vi.spyOn(liveSchema, 'parseLiveState');
    store.dispatch(
      expectSuccess(parseLiveCommand({type: 'macro.run', macroId: uuid(9)})),
    );
    expect(size).toHaveBeenCalledTimes(1);
    expect(shape).toHaveBeenCalledTimes(1);
    release();
  });

  it('rejects a whole nested dispatch whose final state fails and runs none of its observations', () => {
    const outputs = Object.fromEntries(
      Array.from({length: LIVE_STATE_LIMITS.outputs}, (_, i) => [
        uuid(i),
        true,
      ]),
    );
    const store = new LiveStore(
      {...emptyLiveState(), outputs},
      () => 0,
      new SliceRegistry([
        outputsSlice,
        batchSlice,
        macrosSlice,
        screenSettingsSlice,
      ]),
    );
    const observed = vi.fn();
    const run = vi.fn<MacroCommandPort['run']>((history, _command, context) => {
      context.defer(observed);
      return context.apply(history, {
        type: 'output.set',
        screenId: 'main',
        on: true,
      });
    });
    const release = store.connectMacros({run});
    const screens = screenSettingsPort();
    const releaseScreens = store.connectScreenSettings(screens);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.state;
    const log = recordingLogger();
    dispatchLogged(
      store,
      expectSuccess(
        parseLiveCommand({
          type: 'live.batch',
          commands: [
            {type: 'output.set', screenId: 'stage', on: true},
            {type: 'screen.settings.apply', screenId: uuid(1)},
            {type: 'macro.run', macroId: uuid(9)},
            {type: 'output.set', screenId: uuid(999), on: true},
          ],
        }),
      ),
      log,
    );
    expect(run).toHaveBeenCalledOnce();
    expect(observed).not.toHaveBeenCalled();
    expect(screens.requireSaved).toHaveBeenCalledExactlyOnceWith(uuid(1));
    expect(screens.queueRefresh).not.toHaveBeenCalled();
    expect(store.state).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    expect(log.messages('warn')).toEqual(['skipped live command']);
    expect(log.entries[0]).toMatchObject({
      detail: {
        type: 'live.batch',
        reason: 'invalid-overlay',
        error: {field: 'outputs'},
      },
    });
    unsubscribe();
    release();
    releaseScreens();
  });

  it('checks a failing 256-child batch nested inside a macro once', () => {
    const outputs = Object.fromEntries(
      Array.from({length: LIVE_STATE_LIMITS.outputs}, (_, i) => [
        uuid(i),
        true,
      ]),
    );
    const store = new LiveStore(
      {...emptyLiveState(), outputs},
      () => 0,
      new SliceRegistry([outputsSlice, batchSlice, macrosSlice]),
    );
    const release = store.connectMacros({
      run: (history, _command, context) =>
        context.apply(history, {
          type: 'live.batch',
          commands: [
            ...Array.from({length: 255}, (_, index) => ({
              type: 'output.set' as const,
              screenId: 'main',
              on: index % 2 === 0,
            })),
            {type: 'output.set', screenId: uuid(999), on: true},
          ],
        }),
    });
    const size = vi.spyOn(budget, 'fitsLiveStateByteBudget');
    const shape = vi.spyOn(liveSchema, 'parseLiveState');
    const before = store.state;
    expect(
      store.dispatch(
        expectSuccess(parseLiveCommand({type: 'macro.run', macroId: uuid(9)})),
      ),
    ).toBe(false);
    expect(store.state).toBe(before);
    expect(shape).toHaveBeenCalledOnce();
    expect(size).not.toHaveBeenCalled();
    release();
  });

  it('keeps 200 canonical outputs and all aliases saveable, then rejects the next output without notifying', () => {
    const store = new LiveStore(undefined, () => 0, registry());
    const defaults = expectSuccess(
      parseSettingsDocument({
        name: 'screens',
        revision: 1,
        access: 'editable',
        value: {
          format: 'llsettings.screens',
          schemaVersion: 1,
          ...settingsDefaults.screens,
        },
      }),
    );
    if (
      defaults.name !== 'screens' ||
      defaults.value.screens[0] === undefined
    ) {
      throw new Error('Missing screens');
    }
    const first = defaults.value.screens[0];
    const screens = [
      ...defaults.value.screens,
      ...Array.from(
        {length: LIVE_STATE_LIMITS.outputs + 1 - defaults.value.screens.length},
        (_, i) => ({...first, id: uuid(1000 + i)}),
      ),
    ];
    const document = expectSuccess(
      parseSettingsDocument({...defaults, value: {...defaults.value, screens}}),
    );
    const releaseSettings = store.connectSettings({
      get: () => document,
      preferences: () => defaultPreferences,
      subscribe: () => () => undefined,
    });
    const keys = [
      ...screens.slice(0, LIVE_STATE_LIMITS.outputs).map(screen => screen.id),
      ...LIVE_OUTPUT_ALIASES,
    ];
    const command = expectSuccess(
      parseLiveCommand({
        type: 'live.batch',
        commands: keys.map(screenId => ({
          type: 'output.set',
          screenId,
          on: true,
        })),
      }),
    );
    store.dispatch(command);
    expect(Object.keys(store.state.outputs)).toHaveLength(
      LIVE_STATE_LIMITS.outputs + LIVE_OUTPUT_ALIASES.length,
    );
    expect(canSave(store.state)).toBe(true);
    const before = store.state;
    const listener = vi.fn();
    const release = store.subscribe(listener);
    const log = recordingLogger();
    const extra = expectSuccess(
      parseLiveCommand({
        type: 'output.set',
        screenId: screens.at(-1)?.id,
        on: true,
      }),
    );
    dispatchLogged(store, extra, log);
    expect(store.state).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    expect(log.messages('warn')).toEqual(['skipped live command']);
    expect(log.entries[0]).toHaveProperty('detail.error.field', 'outputs');
    store.dispatch({type: 'output.set', screenId: 'main', on: false});
    expect(store.state.outputs['main']).toBe(false);
    expect(canSave(store.state)).toBe(true);
    release();
    releaseSettings();
  });

  it('rejects a batch whose valid children together overflow the byte budget', () => {
    const slide = {
      itemId: 'item',
      position: 0,
      label: null,
      lines: Array.from({length: LIVE_STATE_LIMITS.slideLines}, () =>
        '가'.repeat(1380),
      ),
    };
    expect(parseLiveCommand({type: 'slide.show', slide}).ok).toBe(true);
    const initial = {
      ...emptyLiveState(),
      layers: {...emptyLiveState().layers, slide},
    };
    expect(parseLiveState(initial).ok).toBe(true);
    expect(canSave(initial)).toBe(true);
    const message = {
      messageId: 'summary',
      text: '',
      items: Array.from({length: MAX_ACTIVE_MESSAGES}, (_, i) => ({
        messageId: uuid(i),
        text: '나'.repeat(LIVE_STATE_LIMITS.textCharacters),
        targets: 'all',
        excludedTargets: [],
        startedAt: 0,
        expiresAt: null,
      })),
    };
    const command = expectSuccess(
      parseLiveCommand({
        type: 'live.batch',
        commands: [
          {type: 'message.show', message},
          {type: 'output.set', screenId: 'main', on: true},
        ],
      }),
    );
    const store = new LiveStore(initial, () => 0, registry());
    const before = store.state;
    const size = vi.spyOn(budget, 'fitsLiveStateByteBudget');
    const shape = vi.spyOn(liveSchema, 'parseLiveState');
    const log = recordingLogger();
    dispatchLogged(store, command, log);
    expect(store.state).toBe(before);
    expect(store.state.layers.message).toBeNull();
    expect(store.state.outputs).toEqual({});
    expect(shape).toHaveBeenCalledOnce();
    expect(size).toHaveBeenCalledOnce();
    expect(log.messages('warn')).toEqual(['skipped live command']);
    expect(log.entries[0]).toMatchObject({
      detail: {type: 'live.batch', error: {field: ''}},
    });
    expect(canSave(store.state)).toBe(true);
  });

  it.each([
    LIVE_STATE_LIMITS.textCharacters,
    LIVE_STATE_LIMITS.textCharacters + 1,
  ])(
    'validates settings-derived prop text of length %s before committing it',
    length => {
      const style = expectSuccess(
        parseSettingsDocument({
          name: 'looks',
          revision: 1,
          access: 'editable',
          value: {
            format: 'llsettings.looks',
            schemaVersion: 1,
            ...settingsDefaults.looks,
          },
        }),
      );
      if (style.name !== 'looks' || style.value.lyricStyles[0] === undefined) {
        throw new Error('Missing style');
      }
      const document = expectSuccess(
        parseSettingsDocument({
          name: 'props',
          revision: 1,
          access: 'editable',
          value: {
            format: 'llsettings.props',
            schemaVersion: 1,
            props: [
              {
                id: uuid(1),
                name: 'Invented prop',
                content: {
                  kind: 'text',
                  text: 'x'.repeat(length),
                  style: style.value.lyricStyles[0],
                },
                targets: [],
              },
            ],
          },
        }),
      );
      const store = new LiveStore(undefined, () => 0, registry());
      const release = store.connectSettings({
        get: () => document,
        preferences: () => defaultPreferences,
        subscribe: () => () => undefined,
      });
      const command = expectSuccess(
        parseLiveCommand({type: 'prop.set', propId: uuid(1), on: true}),
      );
      const accepted = length === LIVE_STATE_LIMITS.textCharacters;
      const log = recordingLogger();
      dispatchLogged(store, command, log);
      expect(store.state.layers.prop !== null).toBe(accepted);
      expect(log.messages('warn')).toHaveLength(accepted ? 0 : 1);
      expect(canSave(store.state)).toBe(true);
      const value = {
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          prop: {
            propId: 'summary',
            items:
              document.name === 'props'
                ? document.value.props.map(prop => ({
                    propId: prop.id,
                    content: prop.content,
                    targets: prop.targets,
                  }))
                : [],
          },
        },
      };
      expect(canSave(value)).toBe(accepted);
      release();
    },
  );
});
