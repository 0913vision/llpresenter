import {describe, expectTypeOf, it} from 'vitest';
import type {StageElementId} from './ids';
import {
  parseStageLayouts,
  serializeStageLayouts,
  stageElementKinds,
  type StageElement,
} from './stageLayouts';
import {expectInvalidField, expectRoundTrip} from './testHelpers';

const codec = {parse: parseStageLayouts, serialize: serializeStageLayouts};
const CURRENT_AND_NEXT = '77777777-7777-4777-8777-777777777777';

function currentLyrics() {
  return {
    id: 'current-lyrics',
    name: '현재 가사',
    kind: 'currentSlide',
    show: 'text',
    frame: {x: 40, y: 120, w: 1840, h: 520},
    text: {
      font: 'Pretendard',
      weight: 700,
      size: 96,
      color: '#FFFFFF',
      align: 'left',
      vAlign: 'top',
      lineHeight: 1.3,
      autoFit: true,
    },
    box: {background: '#000000', opacity: 0.6},
  };
}

function currentAndNext() {
  return {
    format: 'llsettings.stage',
    schemaVersion: 1,
    layouts: [
      {
        id: CURRENT_AND_NEXT,
        name: '현재와 다음',
        width: 1920,
        height: 1080,
        elements: [
          currentLyrics(),
          {
            id: 'clock',
            name: '시계',
            kind: 'clock',
            frame: {x: 1600, y: 20, w: 280, h: 80},
          },
        ],
      },
    ],
  };
}

function withElement(element: object) {
  const file = currentAndNext();
  const [layout] = file.layouts;
  return {...file, layouts: [{...layout, elements: [element]}]};
}

describe('parseStageLayouts', () => {
  it('reads the 현재와 다음 layout', () => {
    expectRoundTrip(codec, currentAndNext());
  });

  it('reads every element kind', () => {
    for (const kind of stageElementKinds) {
      expectRoundTrip(codec, withElement({...currentLyrics(), kind}));
    }
  });

  it('keeps unknown fields in elements, frames, and text', () => {
    const element = currentLyrics();
    expectRoundTrip(
      codec,
      withElement({
        ...element,
        frame: {...element.frame, rotation: 0},
        text: {...element.text, italic: false},
        locked: true,
      }),
    );
  });

  it.each([
    ['an unknown kind', {kind: 'video'}, 'layouts.0.elements.0.kind'],
    ['an unknown show value', {show: 'chords'}, 'layouts.0.elements.0.show'],
    [
      'a negative width',
      {frame: {x: 0, y: 0, w: -1, h: 10}},
      'layouts.0.elements.0.frame.w',
    ],
    [
      'an opacity over 1',
      {box: {opacity: 1.5}},
      'layouts.0.elements.0.box.opacity',
    ],
    [
      'text without autoFit',
      {text: {...currentLyrics().text, autoFit: 'yes'}},
      'layouts.0.elements.0.text.autoFit',
    ],
    ['a blank id', {id: ''}, 'layouts.0.elements.0.id'],
  ])('rejects an element with %s', (_name, change, field) => {
    expectInvalidField(
      codec,
      withElement({...currentLyrics(), ...change}),
      field,
    );
  });
});

describe('stage layout types', () => {
  it('brands element ids', () => {
    expectTypeOf<StageElement['id']>().toEqualTypeOf<StageElementId>();
  });
});
