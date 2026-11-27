import {defineSlice} from '../slice';

/**
 * The slice of the `themes.refresh`, `item.start` and `item.stop` commands,
 * which wait for the theme output; the theme runtime keeps the slide's theme
 * in step with the shown slide.
 */
export const themesSlice = defineSlice({
  commands: ['themes.refresh', 'item.start', 'item.stop'],
  initial: {},
  reduce: (history, _command, context) =>
    context.themes === undefined
      ? context.reject({field: '', message: 'Theme output is not ready'})
      : history,
});
