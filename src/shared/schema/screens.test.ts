import {describe, expectTypeOf, it} from 'vitest';
import type {ScreenId} from './ids';
import {parseScreens, serializeScreens, type Screen} from './screens';
import {expectInvalidField, expectRoundTrip} from './testHelpers';

const codec = {parse: parseScreens, serialize: serializeScreens};
const MAIN_ID = '11111111-1111-4111-8111-111111111111';
const CAPTION_ID = '22222222-2222-4222-8222-222222222222';
const STAGE_ID = '33333333-3333-4333-8333-333333333333';

function mainScreen() {
  return {
    id: MAIN_ID,
    name: '본 화면',
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
    preventSleep: true,
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
        name: '방송 자막',
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
  it('reads the three default screens', () => {
    expectRoundTrip(codec, defaultScreens());
  });

  it('keeps NDI settings and unknown fields for later versions', () => {
    expectRoundTrip(
      codec,
      withScreen({
        ...mainScreen(),
        method: 'ndi',
        ndi: {
          sourceName: 'LOVELIGHT 방송 자막',
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
    ['an unknown kind', {kind: 'main'}, 'screens.0.kind'],
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

  it('rejects two screens with the same id', () => {
    const screens = {
      ...defaultScreens(),
      screens: [mainScreen(), {...mainScreen(), name: '복사본'}],
    };

    expectInvalidField(codec, screens, 'screens.1');
  });
});

describe('screen types', () => {
  it('brands the id', () => {
    expectTypeOf<Screen['id']>().toEqualTypeOf<ScreenId>();
    expectTypeOf<Screen['method']>().toEqualTypeOf<
      'fullscreen' | 'window' | 'capture' | 'ndi'
    >();
  });
});
