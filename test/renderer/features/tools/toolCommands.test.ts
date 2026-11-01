import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  hideStageMessage,
  toggleActiveNotice,
} from '@renderer/features/tools/toolCommands';
import {useLive} from '@renderer/session/live';

const NOTICE = '44000000-0000-4000-8000-000000000021';
const send = vi.fn<(command: LiveCommand) => void>();

function live(change: object): void {
  const state: LiveState = expectSuccess(
    parseLiveState({...emptyLiveState(), ...change}),
  );
  useLive.setState({state});
}

function notice(pausedAt: number | null): object {
  return {
    layers: {
      ...emptyLiveState().layers,
      notice: {
        noticeId: NOTICE,
        playback: {
          media: ['44000000-0000-4000-8000-000000000022'],
          position: 0,
          interval: 8,
          loop: true,
          targets: ['00000000-0000-4000-8000-000000000003'],
          startedAt: 1000,
          pausedAt,
        },
      },
    },
  };
}

beforeEach(() => {
  send.mockClear();
  window.llp = mockLlpApi({live: {send}});
});
afterEach(() => {
  delete window.llp;
  useLive.setState({state: null});
});

describe('toggleActiveNotice', () => {
  it('pauses a playing notice, starts a paused one, and does nothing without one', () => {
    live(notice(null));
    toggleActiveNotice();
    expect(send).toHaveBeenLastCalledWith({type: 'notice.pause'});

    live(notice(2000));
    toggleActiveNotice();
    expect(send).toHaveBeenLastCalledWith({
      type: 'notice.start',
      noticeId: NOTICE,
    });

    send.mockClear();
    live({});
    toggleActiveNotice();
    expect(send).not.toHaveBeenCalled();
  });
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
