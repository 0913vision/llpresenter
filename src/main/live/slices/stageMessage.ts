import {defineSlice} from '../slice';
import {resetClearToggles} from '../history';

export const stageMessageSlice = defineSlice({
  commands: ['stage.message.set'],
  initial: {},
  reduce: (history, {text}, {settings}) => {
    const shown = history.state.testPatterns ?? [];
    const screens =
      text !== null && shown.length > 0 ? settings?.get('screens') : undefined;
    const stages = new Set(
      screens?.name === 'screens'
        ? screens.value.screens
            .filter(screen => screen.kind === 'stage')
            .map(screen => screen.id)
        : [],
    );
    const patterns = shown.filter(id => !stages.has(id));
    const changedPatterns = patterns.length !== shown.length;
    if ((history.state.stageMessage ?? null) === text && !changedPatterns) {
      return history;
    }
    if (text !== null) history = resetClearToggles(history);
    const endsUndo = history.undo?.stageMessage !== undefined;
    return {
      ...history,
      undo: endsUndo ? null : history.undo,
      state: {
        ...history.state,
        stageMessage: text,
        ...(changedPatterns ? {testPatterns: patterns} : {}),
        canUndo: endsUndo ? false : history.state.canUndo,
        version: history.state.version + 1,
      },
    };
  },
});
