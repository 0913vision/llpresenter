import {defineSlice} from '../slice';

/** 모니터 번호 표시: shows the monitor numbers after the dispatch, changing no state. */
export const monitorsSlice = defineSlice({
  commands: ['monitors.identify'],
  initial: {},
  reduce: (history, _command, {monitorNumbers, defer}) => {
    if (monitorNumbers === undefined) {
      throw new Error('Monitor numbers are not ready');
    }
    defer(() => monitorNumbers.identify());
    return history;
  },
});
