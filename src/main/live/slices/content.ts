import type {MediaChoice, SlideLayer} from '@core/live/state';
import {setLayer, type LiveHistory} from '../history';
import {defineSlice} from '../slice';

function clearPreviousPicture(
  history: LiveHistory,
  slide: SlideLayer,
): LiveHistory {
  const media = history.state.layers.media;
  return slide.picture === undefined && media?.slidePicture === true
    ? setLayer(history, 'media', null)
    : history;
}

function showMedia(
  history: LiveHistory,
  choice: MediaChoice,
  now: number,
): LiveHistory {
  const current = history.state.layers.media;
  if (current?.mediaId !== choice.mediaId) {
    return setLayer(history, 'media', {...choice, startedAt: now});
  }
  // NOTE(0913vision): The same background shown again keeps playing from
  // where it is, so it keeps its start time (docs/spec/03-output.md).
  if (
    current.loop === choice.loop &&
    current.itemId === choice.itemId &&
    current.title === choice.title &&
    current.slidePicture === choice.slidePicture
  ) {
    return history;
  }
  const {
    itemId: _itemId,
    title: _title,
    slidePicture: _slidePicture,
    ...playback
  } = current;
  return setLayer(history, 'media', {...playback, ...choice});
}

/** Puts content on a layer: a slide, a background, or a message. */
export const contentSlice = defineSlice({
  commands: ['slide.show', 'media.show', 'message.show'],
  initial: {layers: {slide: null, media: null, message: null}},
  reduce: (history, command, context) => {
    switch (command.type) {
      case 'slide.show': {
        const shown = setLayer(
          clearPreviousPicture(history, command.slide),
          'slide',
          command.slide,
        );
        const media = shown.state.layers.media;
        const library = context.audioMedia?.();
        // NOTE(0913vision): A background that left the library stays on screen
        // until the next slide, which no longer draws it (spec 08).
        if (
          media === null ||
          library === undefined ||
          library.items.some(item => item.id === media.mediaId)
        ) {
          return shown;
        }
        return context.apply(setLayer(shown, 'media', null), {
          type: 'media.properties.refresh',
        });
      }
      case 'media.show':
        return context.apply(showMedia(history, command.media, context.now), {
          type: 'media.properties.refresh',
        });
      case 'message.show':
        return setLayer(history, 'message', command.message);
    }
  },
});
