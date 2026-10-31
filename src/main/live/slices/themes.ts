import {defineSlice} from '../slice';

export const themesSlice = defineSlice({
  commands: ['theme.set', 'themes.refresh', 'item.stop'],
  initial: {},
  reduce: (history, _command, context) =>
    context.themes === undefined
      ? context.reject({field: '', message: 'Theme output is not ready'})
      : history,
});
