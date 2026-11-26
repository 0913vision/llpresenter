import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/schema/live/liveCommand';
import {emptyLiveState} from '@core/schema/live/live';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {hideStageMessage} from '@renderer/features/tools/toolCommands';
import {useLive} from '@renderer/session/live';
const send = vi.fn<(command: LiveCommand) => void>();

beforeEach(() => {
  send.mockClear();
  window.llp = mockLlpApi({live: {send}});
});
afterEach(() => {
  delete window.llp;
  useLive.setState({state: null});
});

describe('hideStageMessage', () => {
  it('asks main to take the 무대 text down on each press, even before this window hears it was shown', () => {
    useLive.setState({state: emptyLiveState()});
    hideStageMessage();
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'stage.message.set',
      text: null,
    });
  });
});
