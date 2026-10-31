import type {LiveState, MediaLayer} from '../live/state';
import {themeOverlay} from './content';

/** Sound is owned by one audio window, even when several screens show it. */
export function themeMediaAudible(state: LiveState): boolean {
  const kind = state.themeItem?.kind === 'media' ? 'media' : 'background';
  return Object.entries(state.themeOutput?.screens ?? {}).some(
    ([id, screen]) =>
      state.outputs[id] === true &&
      screen.layout.mode.kind === 'own' &&
      screen.layout.elements.some(element => element.kind === kind),
  );
}

export function themeOverlayAudio(state: LiveState): MediaLayer | null {
  const item = state.themeItem ?? null;
  for (const [id, screen] of Object.entries(state.themeOutput?.screens ?? {})) {
    if (
      state.outputs[id] !== true ||
      screen.layout.mode.kind !== 'own' ||
      !screen.layout.elements.some(element => element.kind === 'overlay')
    ) {
      continue;
    }
    const content = themeOverlay(
      item,
      state.layers,
      screen.sourceScreenId,
    )?.content;
    if (
      content !== undefined &&
      'media' in content &&
      typeof content.media === 'string' &&
      'loop' in content &&
      typeof content.loop === 'boolean' &&
      'sound' in content &&
      content.sound
    ) {
      return {
        mediaId: content.media,
        loop: content.loop,
        startedAt: item?.overlayStartedAt ?? item?.startedAt ?? 0,
        properties: {speed: 1, fit: 'fit', volume: 100, audio: true},
      };
    }
  }
  return null;
}
