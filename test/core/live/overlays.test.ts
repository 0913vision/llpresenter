import {describe, expect, it} from 'vitest';
import {createItemOverlayId, createMediaId} from '@core/schema/common/ids';
import {emptyLiveState, type LiveState} from '@core/schema/live/live';
import type {LiveItem} from '@core/schema/live/liveTheme';
import type {PlacedOverlay} from '@core/schema/services/itemOverlays';
import {
  backgroundAudible,
  liveOverlay,
  overlayAudio,
  placedOverlays,
  storedOverlays,
} from '@core/live/overlays';
import {CAPTIONS, MAIN, overlayUuid} from '@fixtures/core/overlays';
import {lyricsSlide, slideId} from '@fixtures/core/slides';

const MR = createMediaId(overlayUuid(40));
const slides = [1, 2, 3, 4].map(number => lyricsSlide(number, `${number}절`));

function overlay(more: Partial<PlacedOverlay> = {}): PlacedOverlay {
  return {
    id: createItemOverlayId(overlayUuid(50)),
    name: 'MR',
    from: 2,
    to: 3,
    screens: [MAIN],
    content: {media: MR, loop: true, sound: true},
    ...more,
  };
}

function songItem(more: Partial<LiveItem> = {}): LiveItem {
  return {
    id: 'song-1',
    kind: 'song',
    source: 'service',
    overlays: [overlay()],
    slidePosition: 1,
    startedAt: 1000,
    ...more,
  };
}

function state(more: Partial<LiveState> = {}): LiveState {
  return {...emptyLiveState(), outputs: {[MAIN]: true}, ...more};
}

describe('placed and stored overlays', () => {
  it('places overlays at the positions of their slides, either way round, and stores them back', () => {
    const stored = [
      {...overlay(), from: slideId(3), to: slideId(2)},
      {
        ...overlay({id: createItemOverlayId(overlayUuid(51))}),
        from: slideId(9),
        to: slideId(1),
      },
    ];
    const placed = placedOverlays(stored, slides);
    expect(placed).toEqual([overlay()]);
    expect(storedOverlays(placed, slides)).toEqual([
      {...overlay(), from: slideId(2), to: slideId(3)},
    ]);
    expect(storedOverlays([overlay({to: 9})], slides)).toEqual([]);
    expect(placedOverlays(undefined, slides)).toEqual([]);
  });
});

describe('liveOverlay', () => {
  it('finds the overlay of the live slide on a screen it names', () => {
    expect(liveOverlay(songItem(), MAIN)).toEqual(overlay());
    expect(liveOverlay(songItem(), CAPTIONS)).toBeUndefined();
    expect(liveOverlay(songItem({slidePosition: 3}), MAIN)).toBeUndefined();
  });

  it('shows none for no item, a cleared one, or one with no slide', () => {
    expect(liveOverlay(null, MAIN)).toBeUndefined();
    expect(liveOverlay(songItem({contentCleared: true}), MAIN)).toBeUndefined();
    const {slidePosition: _slide, ...noSlide} = songItem();
    expect(liveOverlay(noSlide, MAIN)).toBeUndefined();
  });
});

describe('overlayAudio', () => {
  it('plays the sound of a live overlay once, from when the overlay started', () => {
    expect(
      overlayAudio(state({item: songItem({overlayStartedAt: 2500})})),
    ).toEqual({
      mediaId: MR,
      loop: true,
      startedAt: 2500,
      properties: {speed: 1, fit: 'fit', volume: 100, audio: true},
    });
    expect(overlayAudio(state({item: songItem()}))?.startedAt).toBe(1000);
  });

  it('plays nothing with its screen off, its sound off, or a text overlay', () => {
    expect(
      overlayAudio(state({item: songItem(), outputs: {[MAIN]: false}})),
    ).toBeNull();
    const silent = songItem({
      overlays: [overlay({content: {media: MR, loop: true, sound: false}})],
    });
    expect(overlayAudio(state({item: silent}))).toBeNull();
    const text = songItem({overlays: [overlay({content: {text: '광고'}})]});
    expect(overlayAudio(state({item: text}))).toBeNull();
  });
});

describe('backgroundAudible', () => {
  const media = songItem({id: 'media-1', kind: 'media', overlays: []});

  it('hears a live media item while a screen is on and its media is not cleared', () => {
    expect(backgroundAudible(state({item: media}))).toBe(true);
    const shown = {mediaId: MR, loop: true, itemId: 'media-1', startedAt: 0};
    expect(
      backgroundAudible(
        state({
          item: media,
          layers: {...emptyLiveState().layers, media: shown},
        }),
      ),
    ).toBe(true);
  });

  it('hears nothing of a song, with every screen off, or after another media took its place', () => {
    expect(backgroundAudible(state({item: songItem()}))).toBe(false);
    expect(
      backgroundAudible(state({item: media, outputs: {[MAIN]: false}})),
    ).toBe(false);
    const other = {mediaId: MR, loop: true, itemId: 'other', startedAt: 0};
    expect(
      backgroundAudible(
        state({
          item: media,
          layers: {...emptyLiveState().layers, media: other},
        }),
      ),
    ).toBe(false);
  });

  it('hears an outside media item by its media when no item names it', () => {
    const external = {...media, id: MR, source: 'external' as const};
    const shown = {mediaId: MR, loop: true, startedAt: 0};
    expect(
      backgroundAudible(
        state({
          item: external,
          layers: {...emptyLiveState().layers, media: shown},
        }),
      ),
    ).toBe(true);
  });
});
