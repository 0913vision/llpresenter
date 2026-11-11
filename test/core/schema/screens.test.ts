import {describe, expect, it} from 'vitest';
import {parseScreens, serializeScreens} from '@core/schema/screens';
import {
  expectInvalidField,
  expectRoundTrip,
} from '@fixtures/core/schema/testHelpers';

const codec = {parse: parseScreens, serialize: serializeScreens};
const MAIN_ID = '11111111-1111-4111-8111-111111111111';
const CAPTION_ID = '22222222-2222-4222-8222-222222222222';
const STYLE_ID = '44444444-4444-4444-8444-444444444444';
const STAGE_ID = '33333333-3333-4333-8333-333333333333';

function mainScreen() {
  return {
    id: MAIN_ID,
    name: '청중 화면',
    kind: 'audience',
    method: 'fullscreen',
    display: {
      id: 2779098405,
      name: 'EPSON 프로젝터',
      number: 2,
      bounds: {x: -1920, y: 0, width: 1920, height: 1080},
      scaleFactor: 1.25,
    },
    onDisconnect: 'window',
    alwaysOnTop: true,
    edgeMargin: 2.5,
    offset: {x: -4, y: 0},
  };
}

function defaultScreens() {
  return {
    format: 'llsettings.screens',
    schemaVersion: 1,
    screens: [
      mainScreen(),
      {
        id: CAPTION_ID,
        name: '방송 화면',
        kind: 'audience',
        method: 'capture',
        resolution: {width: 1920, height: 1080},
        previewBackground: 'green',
      },
      {id: STAGE_ID, name: '무대 화면', kind: 'stage', method: 'fullscreen'},
    ],
  };
}

function withScreen(screen: object) {
  return {...defaultScreens(), screens: [screen]};
}

describe('parseScreens', () => {
  it('round trips additive Windows identity and future nested fields', () => {
    const screen = mainScreen();
    expectRoundTrip(
      codec,
      withScreen({
        ...screen,
        display: {
          ...screen.display,
          identity: {
            kind: 'windows',
            devicePath: 'path',
            future: true,
            edid: {
              manufacturer: 'DEL',
              product: '1234',
              serial: 'PANEL123',
              future: 1,
            },
          },
        },
      }),
    );
    expectRoundTrip(
      codec,
      withScreen({
        ...screen,
        display: {
          ...screen.display,
          identity: {kind: 'windows', devicePath: 'path'},
        },
      }),
    );
  });
  it.each([
    {kind: 'windows', devicePath: ''},
    {kind: 'windows', devicePath: 'x'.repeat(513)},
    {kind: 'other', devicePath: 'path'},
    {
      kind: 'windows',
      devicePath: 'path',
      edid: {manufacturer: 'DEL', product: '1234', serial: '0000'},
    },
    {
      kind: 'windows',
      devicePath: 'path',
      edid: {manufacturer: 'DEL', product: '1234', serial: 'x'.repeat(65)},
    },
    {
      kind: 'windows',
      devicePath: 'path',
      edid: {manufacturer: 'DEL', product: '1234'},
    },
  ])('rejects invalid monitor identity %j', identity => {
    const screen = mainScreen();
    const value = withScreen({
      ...screen,
      display: {...screen.display, identity},
    });
    const result = parseScreens(JSON.stringify(value), 'screens.json');
    if (result.ok) throw new Error('Invalid identity accepted');
  });
  it.each(['#000000', '#00B140', '#abC123'])(
    'keeps empty color %s',
    emptyColor => {
      expectRoundTrip(codec, withScreen({...mainScreen(), emptyColor}));
    },
  );

  it.each(['green', '#fff', '#00000000', '#GG0000', '', null, 42])(
    'rejects invalid empty color %j',
    emptyColor => {
      expectInvalidField(
        codec,
        withScreen({...mainScreen(), emptyColor}),
        'screens.0.emptyColor',
      );
    },
  );
  it('reads the three default screens', () => {
    expectRoundTrip(codec, defaultScreens());
  });

  it('limits the NDI source name to 64 characters', () => {
    expectRoundTrip(
      codec,
      withScreen({...mainScreen(), ndi: {sourceName: 'a'.repeat(64)}}),
    );
    expectInvalidField(
      codec,
      withScreen({...mainScreen(), ndi: {sourceName: 'a'.repeat(65)}}),
      'screens.0.ndi.sourceName',
    );
  });

  it('accepts hardware acceleration booleans and treats an absent option as off', () => {
    expectRoundTrip(
      codec,
      withScreen({...mainScreen(), ndi: {hardwareAcceleration: true}}),
    );
    expectRoundTrip(
      codec,
      withScreen({...mainScreen(), ndi: {hardwareAcceleration: false}}),
    );
    const parsed = parseScreens(
      JSON.stringify(withScreen({...mainScreen(), ndi: {}})),
      'screens.json',
    );
    if (!parsed.ok) throw new Error('screen did not parse');
    expect(
      parsed.value.data.screens[0]?.ndi?.hardwareAcceleration ?? false,
    ).toBe(false);
    expectInvalidField(
      codec,
      withScreen({...mainScreen(), ndi: {hardwareAcceleration: 'true'}}),
      'screens.0.ndi.hardwareAcceleration',
    );
  });

  it('keeps NDI settings and unknown fields for later versions', () => {
    expectRoundTrip(
      codec,
      withScreen({
        ...mainScreen(),
        method: 'ndi',
        ndi: {
          sourceName: 'LOVELIGHT 방송 화면',
          resolution: {width: 1920, height: 1080},
          fps: 30,
          alpha: true,
          networkInterface: '이더넷 192.168.0.12',
          group: 'public',
          future: 1,
        },
        display: {...mainScreen().display, refreshRate: 60},
        color: 'teal',
      }),
    );
  });

  it.each([
    [
      'a message style id that is not an id',
      {messageStyleId: 'big'},
      'screens.0.messageStyleId',
    ],
    ['an unknown kind', {kind: 'main'}, 'screens.0.kind'],
    ['an offset that is an array', {offset: []}, 'screens.0.offset'],
    ['an NDI block that is an array', {ndi: []}, 'screens.0.ndi'],
    ['an unknown method', {method: 'projector'}, 'screens.0.method'],
    ['an edge margin over 100', {edgeMargin: 120}, 'screens.0.edgeMargin'],
    [
      'a zero-width resolution',
      {resolution: {width: 0, height: 1080}},
      'screens.0.resolution.width',
    ],
    [
      'an unknown preview background',
      {previewBackground: 'blue'},
      'screens.0.previewBackground',
    ],
    [
      'a fractional display position',
      {
        display: {
          ...mainScreen().display,
          bounds: {x: 0.5, y: 0, width: 1, height: 1},
        },
      },
      'screens.0.display.bounds.x',
    ],
  ])('rejects %s', (_name, change, field) => {
    expectInvalidField(codec, withScreen({...mainScreen(), ...change}), field);
  });

  it('keeps the message style a screen picked', () => {
    expectRoundTrip(
      codec,
      withScreen({...mainScreen(), messageStyleId: STYLE_ID}),
    );
  });

  it('rejects two screens with the same id', () => {
    const screens = {
      ...defaultScreens(),
      screens: [mainScreen(), {...mainScreen(), name: '복사본'}],
    };

    expectInvalidField(codec, screens, 'screens.1');
  });
});
