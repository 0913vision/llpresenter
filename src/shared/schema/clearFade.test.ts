import {expect, it} from 'vitest';
import * as v from 'valibot';
import {emptyLiveState} from '../live';
import {clearFadeSchema, CLEAR_FADE_LIMIT_MS} from './clearFade';
import {parseLiveCommand} from './liveCommand';
import {parseLiveState} from './liveState';
import {
  parsePreferences,
  serializePreferences,
  withPreferenceDefaults,
} from './preferences';
import {parseMacros, serializeMacros} from './macros';
import {expectSuccess} from './testHelpers';

const ID = '00000000-0000-4000-8000-000000000001';
const transition = {fade: true, durationMs: 1200};

it('defaults an absent key to instant and fills partial fade options', () => {
  expect(v.parse(clearFadeSchema, {})).toEqual({fade: false, durationMs: 500});
  const saved = expectSuccess(
    parsePreferences(
      JSON.stringify({format: 'llsettings.preferences', schemaVersion: 1}),
      'preferences.json',
    ),
  );
  expect(withPreferenceDefaults(saved.data).clearKeys).toEqual({});
});

it('round-trips additive key and macro fields including unknown option fields', () => {
  const value = {
    format: 'llsettings.preferences',
    schemaVersion: 1,
    clearKeys: {
      futureTarget: {future: 'kept'},
      all: {...transition, future: 1},
      slide: {fade: false, durationMs: 0},
    },
    future: 'kept',
  };
  const saved = expectSuccess(
    parsePreferences(JSON.stringify(value), 'preferences.json'),
  );
  expect(
    JSON.parse(
      expectSuccess(serializePreferences(saved.data, 'preferences.json')),
    ),
  ).toEqual(value);
  const macros = {
    format: 'llsettings.macros',
    schemaVersion: 1,
    collections: [],
    macros: [
      {
        id: ID,
        name: 'Clear check',
        icon: 'play',
        color: 'green',
        actions: [
          {kind: 'clearAll', transition},
          {kind: 'clearLayer', layer: 'slide', transition},
          {
            kind: 'clearLayer',
            prop: ID,
            transition: {...transition, future: 2},
          },
        ],
      },
    ],
  };
  const parsed = expectSuccess(
    parseMacros(JSON.stringify(macros), 'macros.json'),
  );
  expect(
    JSON.parse(expectSuccess(serializeMacros(parsed.data, 'macros.json'))),
  ).toEqual(macros);
});

it.each([
  {fade: 'yes'},
  {durationMs: -1},
  {durationMs: 0.5},
  {durationMs: CLEAR_FADE_LIMIT_MS + 1},
  {durationMs: Infinity},
])('rejects invalid clear timing %j in IPC', invalid => {
  expect(
    parseLiveCommand({
      type: 'layer.clear',
      target: 'slide',
      transition: invalid,
    }).ok,
  ).toBe(false);
});

it('validates per-key names and bounds live effect metadata', () => {
  const header = {format: 'llsettings.preferences', schemaVersion: 1};
  expect(
    parsePreferences(
      JSON.stringify({...header, clearKeys: {slide: {durationMs: -1}}}),
      'preferences.json',
    ).ok,
  ).toBe(false);
  expect(
    parseLiveCommand({
      type: 'overlay.clear',
      target: {kind: 'prop', propId: ID},
      transition,
    }).ok,
  ).toBe(true);
  const effect = {
    target: {kind: 'layer', layer: 'slide'},
    since: 1000,
    durationMs: 1200,
  };
  expect(parseLiveState({...emptyLiveState(), clearEffects: [effect]}).ok).toBe(
    true,
  );
  for (const effects of [
    [{...effect, since: -1}],
    [{...effect, durationMs: 0}],
    [{...effect, target: {kind: 'layer', layer: 'clock'}}],
    Array.from({length: 71}, () => effect),
  ]) {
    expect(
      parseLiveState({...emptyLiveState(), clearEffects: effects}).ok,
    ).toBe(false);
  }
});
