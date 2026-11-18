import type {MediaChoice, SlideLayer} from '@core/live/state';
import {setLayer, updateLayer, type LiveHistory} from '../history';
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
  commands: [
    'slide.show',
    'bible.passage.title.set',
    'stage.next.set',
    'media.show',
    'message.show',
    'black.toggle',
  ],
  initial: {layers: {slide: null, media: null, message: null}},
  reduce: (history, command, context) => {
    switch (command.type) {
      case 'bible.passage.title.set': {
        const slide = history.state.layers.slide;
        const item = history.state.themeItem;
        if (
          slide?.itemId !== command.itemId ||
          slide.position !== command.position ||
          item?.id !== command.itemId ||
          item.kind !== 'bible' ||
          (item.title === command.title && slide.title === command.title)
        ) {
          return history;
        }
        const updated = updateLayer(history, 'slide', {
          ...slide,
          title: command.title,
        });
        return {
          ...updated,
          undo: history.undo,
          state: {
            ...updated.state,
            canUndo: history.state.canUndo,
            themeItem: {...item, title: command.title},
          },
        };
      }
      case 'black.toggle':
        return {
          ...history,
          state: {
            ...history.state,
            blackScreen: !history.state.blackScreen,
            version: history.state.version + 1,
          },
        };
      case 'slide.show': {
        const previous = history.state.layers.slide;
        const incoming = command.slide;
        const changed =
          previous?.itemId !== incoming.itemId ||
          previous.position !== incoming.position ||
          history.state.blackScreen === true;
        const effect =
          incoming.reverseTransition !== undefined
            ? incoming.reverseTransition
            : incoming.transition;
        const {transitionStartedAt: _start, ...slide} = incoming;
        const startedAt =
          changed && effect != null && effect.kind !== 'none'
            ? context.now
            : !changed
              ? previous.transitionStartedAt
              : undefined;
        let shown = setLayer(
          clearPreviousPicture(history, incoming),
          'slide',
          startedAt === undefined
            ? incoming.transitionStartedAt === undefined
              ? incoming
              : slide
            : {...slide, transitionStartedAt: startedAt},
        );
        if (shown.state.blackScreen === true) {
          shown = {
            ...shown,
            state: {
              ...shown.state,
              blackScreen: false,
              version: shown.state.version + 1,
            },
          };
        }
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
      case 'stage.next.set': {
        const slide = history.state.layers.slide;
        if (
          slide?.itemId !== command.itemId ||
          slide.position !== command.position
        ) {
          return history;
        }
        if (
          JSON.stringify(slide.next ?? null) === JSON.stringify(command.next)
        ) {
          return history;
        }
        const {next: _next, ...current} = slide;
        const nextSlide =
          command.next === null ? current : {...current, next: command.next};
        const updated = updateLayer(history, 'slide', nextSlide);
        const undo = history.undo;
        if (undo === null) return updated;
        const saved = undo.layers.slide;
        const preserved =
          saved?.itemId === slide.itemId && saved.position === slide.position
            ? {...undo, layers: {...undo.layers, slide: nextSlide}}
            : undo;
        return {
          ...updated,
          undo: preserved,
          state: {...updated.state, canUndo: history.state.canUndo},
        };
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
