import type {
  ItemOverlay,
  PlacedOverlay,
} from '@core/schema/services/itemOverlays';
import type {LiveItem} from '@core/schema/live/liveTheme';
import type {Slide} from '@core/schema/slides/slide';
import {normalizeOverlayRanges} from '@core/overlays';
import type {LiveState, MediaLayer} from '@core/schema/live/live';

/** The overlays of an item at the positions of their slides. */
export function placedOverlays(
  overlays: readonly ItemOverlay[] | undefined,
  slides: readonly Slide[],
): readonly PlacedOverlay[] {
  const at = new Map(slides.map((slide, index) => [slide.id, index + 1]));
  return normalizeOverlayRanges(
    (overlays ?? []).flatMap(overlay => {
      const from = at.get(overlay.from);
      const to = at.get(overlay.to);
      return from === undefined || to === undefined
        ? []
        : [{...overlay, from: Math.min(from, to), to: Math.max(from, to)}];
    }),
  );
}

/** The same overlays on the slides at their positions. */
export function storedOverlays(
  placed: readonly PlacedOverlay[],
  slides: readonly Slide[],
): readonly ItemOverlay[] {
  return placed.flatMap(overlay => {
    const from = slides[overlay.from - 1]?.id;
    const to = slides[overlay.to - 1]?.id;
    return from === undefined || to === undefined
      ? []
      : [{...overlay, from, to}];
  });
}

/** The overlay of an item that a screen shows on its live slide. */
export function liveOverlay(
  item: LiveItem | null | undefined,
  screenId: string,
): PlacedOverlay | undefined {
  if (item == null || item.contentCleared === true) return undefined;
  if (item.slidePosition === undefined) return undefined;
  const position = item.slidePosition + 1;
  return item.overlays?.find(
    overlay =>
      overlay.from <= position &&
      overlay.to >= position &&
      overlay.screens.some(screen => screen === screenId),
  );
}

/**
 * Whether the sound of the live background is heard: a media item's is while a
 * screen is on, and fades when its media is cleared.
 */
export function backgroundAudible({item, layers, outputs}: LiveState): boolean {
  if (item?.kind !== 'media' || !Object.values(outputs).includes(true)) {
    return false;
  }
  const {media} = layers;
  return (
    media === null ||
    media.itemId === item.id ||
    (item.source === 'external' && media.mediaId === item.id)
  );
}

/** The sound of an overlay, owned by one window for every screen. */
export function overlayAudio(state: LiveState): MediaLayer | null {
  const item = state.item ?? null;
  for (const [screen, on] of Object.entries(state.outputs)) {
    if (!on) continue;
    const content = liveOverlay(item, screen)?.content;
    if (content === undefined || !('media' in content) || !content.sound) {
      continue;
    }
    return {
      mediaId: content.media,
      loop: content.loop,
      startedAt: item?.overlayStartedAt ?? item?.startedAt ?? 0,
      properties: {speed: 1, fit: 'fit', volume: 100, audio: true},
    };
  }
  return null;
}
