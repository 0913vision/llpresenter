import type {MediaChoice} from '@shared/live';
import {setLayer, type LiveHistory} from '../history';
import {defineSlice} from '../slice';

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
  if (current.loop === choice.loop) return history;
  return setLayer(history, 'media', {...current, loop: choice.loop});
}

/** Puts content on a layer: a slide, a background, or a message. */
export const contentSlice = defineSlice({
  commands: ['slide.show', 'media.show', 'message.show'],
  initial: {layers: {slide: null, media: null, message: null}},
  reduce: (history, command, now) => {
    switch (command.type) {
      case 'slide.show':
        return setLayer(history, 'slide', command.slide);
      case 'media.show':
        return showMedia(history, command.media, now);
      case 'message.show':
        return setLayer(history, 'message', command.message);
    }
  },
});
