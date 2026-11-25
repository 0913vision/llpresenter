import {afterEach, describe, expect, it} from 'vitest';
import {emptyLiveState} from '@core/schema/live/live';
import {SLIDE_LIMITS} from '@core/schema/slides/slide';
import type {SlideDeck} from '@renderer/features/slides/slideDeck';
import {
  addReason,
  copyReason,
  FULL_REASON,
  removeReason,
  selectionReason,
} from '@renderer/features/slides/deckCommands';
import {selectInDeck} from '@renderer/features/slides/deckSelection';
import {
  NEWER_FILE_REASON,
  ON_SCREEN_REASON,
} from '@renderer/platform/problemReasons';
import {useLive} from '@renderer/session/live';
import {shownText} from '@fixtures/core/liveSlide';
import {lyricsSlide, slideId} from '@fixtures/core/slides';

const ITEM = 'item-sunday-song';

function deck(
  slides = [lyricsSlide(1, '첫 줄'), lyricsSlide(2, '둘째 줄')],
  readOnly = false,
): SlideDeck {
  return {
    id: ITEM,
    item: undefined,
    source: {kind: 'song', title: '빛의 길'},
    slides,
    readOnly,
    canUndo: false,
    canRedo: false,
    edit: () => undefined,
    replay: () => undefined,
  };
}

afterEach(() => {
  useLive.setState({state: emptyLiveState()});
});

describe('the reasons the slide editor gives', () => {
  it('refuses every change to a file of a newer version', () => {
    const locked = deck(undefined, true);
    expect(addReason(locked)).toBe(NEWER_FILE_REASON);
    expect(selectionReason(locked)).toBe(NEWER_FILE_REASON);
  });

  it('refuses slides past the cap of a deck', () => {
    const full = deck(
      Array.from({length: SLIDE_LIMITS.slides}, (_, index) =>
        lyricsSlide(index + 1, ''),
      ),
    );
    expect(addReason(full)).toBe(FULL_REASON);
    expect(addReason(deck(), 2)).toBeUndefined();
  });

  it('needs a selection to change, copy or remove slides', () => {
    const open = deck();
    selectInDeck(open, {type: 'clear'});
    expect(selectionReason(open)).toBeDefined();
    expect(copyReason(open)).toBeDefined();
    selectInDeck(open, {type: 'click', id: slideId(2)});
    expect(selectionReason(open)).toBeUndefined();
    expect(copyReason(open)).toBeUndefined();
  });

  it('refuses to remove the slide that is on the screens, and lets the others go', () => {
    const open = deck();
    const state = emptyLiveState();
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          slide: {itemId: ITEM, position: 1, ...shownText('둘째 줄', 2)},
        },
      },
    });

    selectInDeck(open, {type: 'click', id: slideId(2)});
    expect(removeReason(open)).toBe(ON_SCREEN_REASON);
    selectInDeck(open, {type: 'click', id: slideId(1)});
    expect(removeReason(open)).toBeUndefined();
  });
});
