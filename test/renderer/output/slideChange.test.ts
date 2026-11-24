import {describe, expect, it} from 'vitest';
import {emptyLiveState, type LiveState} from '@core/schema/live';
import {shownText} from '@fixtures/core/liveSlide';
import {themeOutput} from '@fixtures/core/themeOutput';
import {slideChangeOf, slideMoved} from '@renderer/output/slideChange';
import {CUT} from '@renderer/output/slideSwitch';

const SCREEN = 'screen-1';
const WIPE = {kind: 'wipe', dir: 'left', sec: 1} as const;

function live(
  number: number | null,
  more: {
    readonly on?: boolean;
    readonly black?: boolean;
    readonly started?: boolean;
  } = {},
): LiveState {
  const empty = emptyLiveState();
  return {
    ...empty,
    outputs: {[SCREEN]: more.on ?? true},
    blackScreen: more.black ?? false,
    layers: {
      ...empty.layers,
      slide:
        number === null
          ? null
          : {
              ...shownText(`가사 ${number}`, number),
              itemId: 'item',
              position: number,
              transition: WIPE,
              ...(more.started === false ? {} : {transitionStartedAt: 1}),
            },
    },
  };
}

const audience = {id: SCREEN, kind: 'audience', on: true, revealing: false};

describe('slideChangeOf', () => {
  it('moves 청중 to another slide through its transition', () => {
    expect(slideChangeOf(live(1), live(2), audience)).toEqual({
      kind: 'change',
      effect: WIPE,
    });
  });

  it('draws 무대 at once, ending what still runs', () => {
    expect(
      slideChangeOf(live(1), live(2), {...audience, kind: 'stage'}),
    ).toEqual({kind: 'draw', end: true});
  });

  it('draws at once while the screen waits to be revealed or is off', () => {
    expect(
      slideChangeOf(live(1), live(2), {...audience, revealing: true}),
    ).toEqual({kind: 'draw', end: true});
    expect(slideChangeOf(live(1), live(2), {...audience, on: false})).toEqual({
      kind: 'draw',
      end: true,
    });
  });

  it('brings 청중 back from black through the transition', () => {
    expect(slideChangeOf(live(1, {black: true}), live(1), audience)).toEqual({
      kind: 'change',
      effect: WIPE,
    });
  });

  it('ends a transition when the same slide comes back without one', () => {
    expect(slideChangeOf(live(1), live(1, {started: false}), audience)).toEqual(
      {kind: 'draw', end: true},
    );
  });

  it('keeps a running transition when nothing about the slide changed', () => {
    expect(slideChangeOf(live(1), live(1), audience)).toEqual({
      kind: 'draw',
      end: false,
    });
  });

  it('cuts any screen to a slide on another background', () => {
    const before = live(1);
    const after: LiveState = {
      ...live(2, {started: false}),
      themeOutput: themeOutput(),
    };
    expect(slideChangeOf(before, after, {...audience, kind: 'stage'})).toEqual({
      kind: 'change',
      effect: CUT,
    });
  });
});

it('tells whether the live slide is another one', () => {
  expect(slideMoved(live(1), live(1))).toBe(false);
  expect(slideMoved(live(1), live(2))).toBe(true);
  expect(slideMoved(null, live(null))).toBe(false);
});
