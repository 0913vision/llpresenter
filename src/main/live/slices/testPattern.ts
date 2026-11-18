import {LIVE_STATE_LIMITS} from '@core/schema/liveLimits';
import {resetClearToggles} from '../history';
import {MissingLiveTargetError} from '../commandErrors';
import {defineSlice} from '../slice';

/**
 * 테스트 패턴: shows or hides the pattern on one screen's output. Only a saved
 * screen shows it; hiding one that is gone still works.
 */
export const testPatternSlice = defineSlice({
  commands: ['screen.testPattern.set'],
  initial: {},
  reduce: (history, {screenId, on}, {settings}) => {
    const {state} = history;
    const document = settings?.get('screens');
    const saved =
      document?.name === 'screens'
        ? document.value.screens.find(screen => screen.id === screenId)
        : undefined;
    if (on && saved === undefined) {
      throw new MissingLiveTargetError({kind: 'screen', id: screenId});
    }
    const shown = state.testPatterns ?? [];
    if (shown.includes(screenId) === on) {
      if (!on) return history;
      const reset = resetClearToggles(history);
      return reset === history
        ? history
        : {...reset, state: {...reset.state, version: state.version + 1}};
    }
    if (on && shown.length >= LIVE_STATE_LIMITS.outputs) {
      throw new Error('Too many screens show the test pattern');
    }
    const testPatterns = on
      ? [...shown, screenId]
      : shown.filter(id => id !== screenId);
    const next = on ? resetClearToggles(history) : history;
    const {testPatterns: _previous, ...rest} = next.state;
    return {
      ...next,
      state: {
        ...rest,
        ...(testPatterns.length === 0 ? {} : {testPatterns}),
        version: state.version + 1,
      },
    };
  },
});
