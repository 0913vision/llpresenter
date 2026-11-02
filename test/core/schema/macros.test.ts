import {describe, expect, it} from 'vitest';
import {layerKinds} from '@core/live/state';
import {
  isKnownMacroAction,
  macroActionKinds,
  parseMacros,
  parseKnownMacroAction,
  serializeMacros,
} from '@core/schema/macros';
import {
  expectInvalidField,
  expectRoundTrip,
  expectSuccess,
} from '@fixtures/core/schema/testHelpers';

const codec = {parse: parseMacros, serialize: serializeMacros};

it('requires a valid theme ID in a theme macro action', () => {
  expect(parseKnownMacroAction({kind: 'theme', theme: 'missing'}).ok).toBe(
    false,
  );
  expect(parseKnownMacroAction({kind: 'theme'}).ok).toBe(false);
});
const SERVICE_START = 'd1d2d3d4-1111-4222-8333-444455556666';
const PRAISE = 'd1d2d3d4-2222-4222-8333-444455556666';
const PRAISE_THEME = '44444444-4444-4444-8444-444444444444';
const WARM_LIGHT = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';
const COUNTDOWN_PROP = 'e1e2e3e4-1111-4222-8333-444455556666';
const CAR_TEMPLATE = 'f1f2f3f4-1111-4222-8333-444455556666';
const SUNDAY_NOTICES = '5c2e9a10-1b2c-4d3e-9f40-5a6b7c8d9e0f';
const OFFERING_MUSIC = 'a9a8a7a6-1111-4222-8333-444455556666';
const PRE_SERVICE_MUSIC = 'c1c2c3c4-1111-4222-8333-444455556666';
const ELAPSED_TIMER = 'b9b8b7b6-1111-4222-8333-444455556666';
const SUNDAY_COLLECTION = '1a2b3c4d-5e6f-4a0b-9c1d-2e3f4a5b6c7d';

function everyAction() {
  return [
    {kind: 'clearAll'},
    {kind: 'clearLayer', layer: 'slide'},
    {kind: 'media', media: WARM_LIGHT},
    {kind: 'prop', prop: COUNTDOWN_PROP, mode: 'off'},
    {
      kind: 'message',
      template: CAR_TEMPLATE,
      values: {'차량 번호': '12가 3456'},
      targets: 'all',
      duration: null,
    },
    {kind: 'notice', notice: SUNDAY_NOTICES},
    {kind: 'audio', operation: 'play', media: OFFERING_MUSIC},
    {kind: 'audioPlaylist', playlist: PRE_SERVICE_MUSIC},
    {kind: 'timer', timer: ELAPSED_TIMER, operation: 'start'},
    {kind: 'macro', macro: PRAISE},
    {kind: 'theme', theme: PRAISE_THEME},
  ];
}

function macrosFile() {
  return {
    format: 'llsettings.macros',
    schemaVersion: 1,
    macros: [
      {
        id: SERVICE_START,
        name: '예배 시작',
        icon: 'play',
        color: 'green',
        actions: [
          {kind: 'theme', theme: PRAISE_THEME},
          {kind: 'prop', prop: COUNTDOWN_PROP, mode: 'off'},
          {kind: 'audio', operation: 'fadeOut'},
          {kind: 'timer', timer: ELAPSED_TIMER, operation: 'start'},
        ],
        runOnStartup: false,
        schedule: {time: '10:30'},
      },
      {
        id: PRAISE,
        name: '찬양',
        icon: 'music-notes',
        color: 'teal',
        actions: [
          {kind: 'theme', theme: PRAISE_THEME},
          {kind: 'media', media: WARM_LIGHT},
        ],
      },
    ],
    collections: [
      {id: SUNDAY_COLLECTION, name: '주일 예배', macroIds: [SERVICE_START]},
    ],
  };
}

function withActions(actions: readonly object[]) {
  const file = macrosFile();
  const [macro] = file.macros;
  return {...file, macros: [{...macro, actions}]};
}

describe('parseMacros', () => {
  it('reads the sample 매크로 with a collection', () => {
    expectRoundTrip(codec, macrosFile());
  });

  it('reads every action kind', () => {
    expect(everyAction().map(({kind}) => kind)).toEqual(macroActionKinds);
    expectRoundTrip(codec, withActions(everyAction()));
  });

  it('keeps an action of an unknown kind and tells it apart', () => {
    const camera = {kind: 'camera', input: 2, on: true};

    const loaded = expectSuccess(
      parseMacros(JSON.stringify(withActions([camera])), 'macros.json'),
    );
    const actions = loaded.data.macros[0]?.actions ?? [];

    expect(actions).toEqual([camera]);
    expect(actions.map(isKnownMacroAction)).toEqual([false]);
    expectRoundTrip(codec, withActions([camera]));
  });

  it.each([
    [
      'a layer that does not exist',
      {kind: 'clearLayer', layer: 'lyrics'},
      'macros.0.actions.0.layer',
    ],
    [
      'an unknown prop mode',
      {kind: 'prop', prop: COUNTDOWN_PROP, mode: 'flash'},
      'macros.0.actions.0.mode',
    ],
    [
      'a clear of a prop name instead of an id',
      {kind: 'clearLayer', prop: '로고'},
      'macros.0.actions.0.prop',
    ],
    [
      'a clear of both a layer and a prop',
      {kind: 'clearLayer', layer: 'slide', prop: COUNTDOWN_PROP},
      'macros.0.actions.0',
    ],
    ['a clear of nothing', {kind: 'clearLayer'}, 'macros.0.actions.0.layer'],
    [
      'message values that are an array',
      {...everyAction()[4], values: []},
      'macros.0.actions.0.values',
    ],
    [
      'a played track without media',
      {kind: 'audio', operation: 'play'},
      'macros.0.actions.0.media',
    ],
    [
      'an unknown audio operation',
      {kind: 'audio', operation: 'pause'},
      'macros.0.actions.0.operation',
    ],
    [
      'a message to a screen name',
      {...everyAction()[4], targets: ['청중 화면']},
      'macros.0.actions.0.targets',
    ],
    [
      'an unknown timer operation',
      {kind: 'timer', timer: ELAPSED_TIMER, operation: 'stop'},
      'macros.0.actions.0.operation',
    ],
    [
      'a theme name instead of an id',
      {kind: 'theme', theme: '찬양'},
      'macros.0.actions.0.theme',
    ],
    [
      'an action without a kind',
      {theme: PRAISE_THEME},
      'macros.0.actions.0.kind',
    ],
    ['a blank kind', {kind: ''}, 'macros.0.actions.0.kind'],
  ])('rejects %s', (_name, action, field) => {
    expectInvalidField(codec, withActions([action]), field);
  });

  it('reads the actions spec 07 lets leave out a field', () => {
    const shortForms = [
      {kind: 'prop', prop: COUNTDOWN_PROP},
      {kind: 'timer', timer: ELAPSED_TIMER},
      {kind: 'clearLayer', prop: COUNTDOWN_PROP},
    ];

    const loaded = expectSuccess(
      parseMacros(JSON.stringify(withActions(shortForms)), 'macros.json'),
    );
    const written = expectSuccess(serializeMacros(loaded.data, 'macros.json'));
    const reread: unknown = JSON.parse(written);

    expect(loaded.data.macros[0]?.actions).toEqual([
      {kind: 'prop', prop: COUNTDOWN_PROP, mode: 'on'},
      {kind: 'timer', timer: ELAPSED_TIMER, operation: 'start'},
      {kind: 'clearLayer', prop: COUNTDOWN_PROP},
    ]);
    expect(reread).toMatchObject({
      macros: [{actions: loaded.data.macros[0]?.actions}],
    });
  });

  it('reads a clear of every layer kind', () => {
    for (const layer of layerKinds) {
      expectRoundTrip(codec, withActions([{kind: 'clearLayer', layer}]));
    }
  });

  it('rejects a tile color of none', () => {
    const file = macrosFile();
    const [macro] = file.macros;

    expectInvalidField(
      codec,
      {...file, macros: [{...macro, color: 'none'}]},
      'macros.0.color',
    );
  });
});
