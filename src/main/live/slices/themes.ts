import {defineSlice} from '../slice';
import {showBackground} from '../media/mediaLayer';

/**
 * The slice of the `theme.set`, `themes.refresh`, `item.start` and `item.stop`
 * commands, which keep the slide background and theme in step with the shown
 * slide.
 */
export const themesSlice = defineSlice({
  commands: ['theme.set', 'themes.refresh', 'item.start', 'item.stop'],
  initial: {},
  reduce: (history, command, context) => {
    if (context.themes === undefined) {
      return context.reject({field: '', message: 'Theme output is not ready'});
    }
    const {slide} = history.state.layers;
    return command.type === 'theme.set' && slide !== null
      ? showBackground(history, slide, {context, theme: command.themeId})
      : history;
  },
});
