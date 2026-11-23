import {defineSlice} from '../slice';
import {showBackground} from '../slideBackground';

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
