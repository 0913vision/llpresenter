import {defineSlice} from '../slice';

export const macrosSlice = defineSlice({
  commands: ['macro.run', 'item.start'],
  initial: {},
  reduce: (history, command, context) =>
    context.macros === undefined
      ? context.reject({
          field: command.type === 'macro.run' ? 'macroId' : 'itemId',
          message: 'Macro execution is not ready',
        })
      : context.macros.run(history, command, context),
});
