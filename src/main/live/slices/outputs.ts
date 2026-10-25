import {defineSlice} from '../slice';
import {resolveOutputScreen} from '@shared/screens';
import {outputStateKeys} from '../../outputs/identity';
import {MissingLiveTargetError} from '../commandErrors';

/** Turns each screen's output on and off. */
export const outputsSlice = defineSlice({
  commands: ['output.set'],
  initial: {outputs: {}},
  reduce: (history, {screenId, on}, {settings}) => {
    const state = history.state;
    const document = settings?.get('screens');
    const saved =
      document?.name === 'screens'
        ? resolveOutputScreen(screenId, document.value.screens)
        : undefined;
    if (
      document !== undefined &&
      (saved === undefined || saved.method === 'ndi') &&
      on
    ) {
      throw new MissingLiveTargetError({kind: 'screen', id: screenId});
    }
    const keys =
      document === undefined
        ? [screenId]
        : outputStateKeys(saved?.id ?? screenId);
    const remove = document !== undefined && saved === undefined;
    if (
      keys.every(key =>
        remove
          ? !Object.hasOwn(state.outputs, key)
          : (state.outputs[key] ?? false) === on,
      )
    ) {
      return history;
    }
    const outputs = remove
      ? Object.fromEntries(
          Object.entries(state.outputs).filter(([key]) => !keys.includes(key)),
        )
      : {...state.outputs, ...Object.fromEntries(keys.map(key => [key, on]))};
    return {...history, state: {...state, version: state.version + 1, outputs}};
  },
});
