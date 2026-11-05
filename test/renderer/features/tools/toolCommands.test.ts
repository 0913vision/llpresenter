import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {hideStageMessage} from '@renderer/features/tools/toolCommands';
import {useLive} from '@renderer/session/live';
const send = vi.fn<(command: LiveCommand) => void>();

function live(change: object): void {
  const state: LiveState = expectSuccess(
    parseLiveState({...emptyLiveState(), ...change}),
  );
  useLive.setState({state});
}

beforeEach(() => {
  send.mockClear();
  window.llp = mockLlpApi({live: {send}});
});
afterEach(() => {
  delete window.llp;
  useLive.setState({state: null});
});

describe('hideStageMessage', () => {
  it('clears a shown stage message and does nothing without one', () => {
    live({stageMessage: '창작 무대 안내'});
    hideStageMessage();
    expect(send).toHaveBeenLastCalledWith({
      type: 'stage.message.set',
      text: null,
    });

    send.mockClear();
    live({});
    hideStageMessage();
    expect(send).not.toHaveBeenCalled();
  });
});
