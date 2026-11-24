import type {SlideLayer} from '@core/schema/live/live';
import {sameJson} from '@core/common/sameJson';
import {setLayer, withLayers} from '../history';
import {defineSlice} from '../slice';
import {showBackground, showMedia} from '../slideBackground';

/** Puts content on a layer: a slide, a background, or a message. */
export const contentSlice = defineSlice({
  commands: [
    'slide.show',
    'slide.update',
    'media.show',
    'message.show',
    'black.toggle',
  ],
  initial: {layers: {slide: null, media: null, message: null}},
  reduce: (history, command, context) => {
    switch (command.type) {
      case 'slide.update': {
        const {layers, item} = history.state;
        const slide = layers.slide;
        if (
          slide?.itemId !== command.slide.itemId ||
          slide.slideId !== command.slide.slideId ||
          item?.contentCleared === true
        ) {
          return history;
        }
        // NOTE(0913vision): The slide stays the same output; only what it shows
        // is new, so a running transition goes on.
        const updated: SlideLayer = {
          ...command.slide,
          ...(slide.transitionStartedAt === undefined
            ? {}
            : {transitionStartedAt: slide.transitionStartedAt}),
          ...(slide.reverseTransition === undefined
            ? {}
            : {reverseTransition: slide.reverseTransition}),
        };
        if (sameJson(slide, updated)) return history;
        const {undo} = history;
        const saved = undo?.layers.slide;
        const shown = withLayers(
          history,
          {...layers, slide: updated},
          undo !== null &&
            saved?.itemId === slide.itemId &&
            saved.slideId === slide.slideId
            ? {...undo, layers: {...undo.layers, slide: updated}}
            : undo,
        );
        return sameJson(
          [slide.background, slide.theme],
          [updated.background, updated.theme],
        )
          ? shown
          : showBackground(shown, updated, {context});
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
          previous.slideId !== incoming.slideId ||
          history.state.blackScreen === true;
        const effect =
          incoming.reverseTransition !== undefined
            ? incoming.reverseTransition
            : incoming.transition;
        const {transitionStartedAt: _start, ...slide} = incoming;
        // NOTE(0913vision): A slide shown again while its transition runs has
        // none any more: it is shown whole at once, as PowerPoint does.
        let shown = setLayer(
          showBackground(history, incoming, {context}),
          'slide',
          changed && effect != null && effect.kind !== 'none'
            ? {...slide, transitionStartedAt: context.now}
            : slide,
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
        return shown;
      }
      case 'media.show':
        return context.apply(
          showMedia(history, {...command.media, chosen: true}, context.now),
          {type: 'media.properties.refresh'},
        );
      case 'message.show':
        return setLayer(history, 'message', command.message);
    }
  },
});
