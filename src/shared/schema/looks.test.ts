import {describe, expectTypeOf, it} from 'vitest';
import type {LyricStyleId, ScreenId} from './ids';
import {
  parseLooks,
  serializeLooks,
  type Look,
  type LyricStyle,
  type ScreenLook,
} from './looks';
import {expectInvalidField, expectRoundTrip} from './testHelpers';

const codec = {parse: parseLooks, serialize: serializeLooks};
const NORMAL_LOOK = '44444444-4444-4444-8444-444444444444';
const MAIN_SCREEN = '11111111-1111-4111-8111-111111111111';
const CAPTION_SCREEN = '22222222-2222-4222-8222-222222222222';
const STAGE_SCREEN = '33333333-3333-4333-8333-333333333333';
const BASIC_STYLE = '55555555-5555-4555-8555-555555555555';
const LOWER_THIRD_STYLE = '66666666-6666-4666-8666-666666666666';
const STAGE_LAYOUT = '77777777-7777-4777-8777-777777777777';

function basicStyle() {
  return {
    id: BASIC_STYLE,
    name: '기본',
    font: 'Pretendard',
    weight: 700,
    color: '#FFFFFF',
    size: 84,
    lineHeight: 1.4,
    align: 'center',
    vAlign: 'middle',
    maxLines: 2,
    margin: 5,
    shadow: true,
    outline: false,
  };
}

function normalLook() {
  return {
    id: NORMAL_LOOK,
    name: '평상시',
    screens: {
      [MAIN_SCREEN]: {
        layers: {media: true, slide: true, prop: true, message: true},
        lyricStyle: BASIC_STYLE,
      },
      [STAGE_SCREEN]: {
        layers: {slide: true, clock: true, stageMessage: true},
        stageLayout: STAGE_LAYOUT,
      },
      [CAPTION_SCREEN]: {
        layers: {media: true, slide: true},
        lyricStyle: LOWER_THIRD_STYLE,
        background: {kind: 'color', color: '#00B140'},
      },
    },
  };
}

function looksFile() {
  return {
    format: 'llsettings.looks',
    schemaVersion: 1,
    current: NORMAL_LOOK,
    looks: [normalLook()],
    lyricStyles: [
      basicStyle(),
      {
        ...basicStyle(),
        id: LOWER_THIRD_STYLE,
        name: '하단 자막',
        vAlign: 'bottom',
      },
    ],
  };
}

describe('parseLooks', () => {
  it('reads the default 평상시 Look and its lyric styles', () => {
    expectRoundTrip(codec, looksFile());
  });

  it('keeps unknown fields in screen Looks, layers, and styles', () => {
    const look = normalLook();
    expectRoundTrip(codec, {
      ...looksFile(),
      looks: [
        {
          ...look,
          screens: {
            [MAIN_SCREEN]: {
              layers: {media: true, camera: true},
              transition: 'fade',
            },
          },
        },
      ],
      lyricStyles: [{...basicStyle(), letterSpacing: 0.02}],
    });
  });

  it.each([
    ['a color without #', {color: 'FFFFFF'}, 'lyricStyles.0.color'],
    ['a short color', {color: '#FFF'}, 'lyricStyles.0.color'],
    ['font weight 0', {weight: 0}, 'lyricStyles.0.weight'],
    ['a right alignment', {align: 'right'}, 'lyricStyles.0.align'],
    ['zero maximum lines', {maxLines: 0}, 'lyricStyles.0.maxLines'],
    ['a blank font', {font: ' '}, 'lyricStyles.0.font'],
  ])('rejects a lyric style with %s', (_name, change, field) => {
    expectInvalidField(
      codec,
      {...looksFile(), lyricStyles: [{...basicStyle(), ...change}]},
      field,
    );
  });

  it.each([
    ['screens that are an array', {screens: []}, 'looks.0.screens'],
    [
      'layers that are an array',
      {screens: {[MAIN_SCREEN]: {layers: []}}},
      `looks.0.screens.${MAIN_SCREEN}.layers`,
    ],
  ])('rejects %s', (_name, change, field) => {
    expectInvalidField(
      codec,
      {...looksFile(), looks: [{...normalLook(), ...change}]},
      field,
    );
  });

  it('rejects a screen key that is not a screen id', () => {
    const look = {...normalLook(), screens: {'본 화면': {layers: {}}}};

    expectInvalidField(
      codec,
      {...looksFile(), looks: [look]},
      'looks.0.screens.본 화면',
    );
  });

  it('rejects an unknown background kind', () => {
    const look = {
      ...normalLook(),
      screens: {[MAIN_SCREEN]: {layers: {}, background: {kind: 'video'}}},
    };

    expectInvalidField(
      codec,
      {...looksFile(), looks: [look]},
      `looks.0.screens.${MAIN_SCREEN}.background.kind`,
    );
  });
});

describe('look types', () => {
  it('keys screen Looks by screen id', () => {
    expectTypeOf<Look['screens']>().toEqualTypeOf<
      Readonly<Record<ScreenId, ScreenLook>>
    >();
    expectTypeOf<ScreenLook['lyricStyle']>().toEqualTypeOf<
      LyricStyleId | undefined
    >();
    expectTypeOf<LyricStyle['align']>().toEqualTypeOf<'left' | 'center'>();
  });
});
