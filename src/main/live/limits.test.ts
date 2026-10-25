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

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const registry = () =>
  new SliceRegistry([batchSlice, outputsSlice, contentSlice, propsSlice]);
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

  it('skips a byte-overflowing child built from valid commands and continues the same batch', () => {
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
    const log = recordingLogger();
    dispatchLogged(store, command, log);
    expect(store.state.layers.slide).toBe(slide);
    expect(store.state.layers.message).toBeNull();
    expect(store.state.outputs['main']).toBe(true);
    expect(store.state.version).toBe(1);
    expect(log.messages('warn')).toEqual(['skipped live command']);
    expect(log.entries[0]).toHaveProperty('detail.type', 'message.show');
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
