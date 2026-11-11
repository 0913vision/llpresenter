import {defineSlice} from '../slice';
import {MissingLiveTargetError} from '../commandErrors';

/**
 * Turns each screen's output on and off. Turning one off also hides its 테스트
 * 패턴, so a pattern never waits on a screen for its next output.
 */
export const outputsSlice = defineSlice({
  commands: ['output.set'],
  initial: {outputs: {}},
  reduce: (history, {screenId, on}, {settings}) => {
    const state = history.state;
    const document = settings?.get('screens');
    const saved =
      document?.name === 'screens'
        ? document.value.screens.find(screen => screen.id === screenId)
        : undefined;
    if (document !== undefined && saved === undefined && on) {
      throw new MissingLiveTargetError({kind: 'screen', id: screenId});
    }
    const remove = document !== undefined && saved === undefined;
    if (
      remove
        ? !Object.hasOwn(state.outputs, screenId)
        : (state.outputs[screenId] ?? false) === on
    ) {
      return history;
    }
    const outputs = remove
      ? Object.fromEntries(
          Object.entries(state.outputs).filter(([key]) => key !== screenId),
        )
      : {...state.outputs, [screenId]: on};
    const {testPatterns, ...rest} = state;
    const patterns = on
      ? testPatterns
      : testPatterns?.filter(id => id !== screenId);
    return {
      ...history,
      state: {
        ...rest,
        ...(patterns === undefined || patterns.length === 0
          ? {}
          : {testPatterns: patterns}),
        version: state.version + 1,
        outputs,
      },
    };
  },
});
