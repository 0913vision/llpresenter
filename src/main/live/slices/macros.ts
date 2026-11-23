import {defineSlice} from '../slice';

export const macrosSlice = defineSlice({
  commands: ['macro.run'],
  initial: {},
  reduce: (history, command, context) =>
    context.macros === undefined
      ? context.reject({
          field: 'macroId',
          message: 'Macro execution is not ready',
        })
      : context.macros.run(history, command, context),
});
