import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {emptyLiveState} from '@core/live/state';
import {createMessageId} from '@core/schema/ids';
import {useLive} from '@renderer/session/live';
import {dismissMessage} from './messageDismiss';

afterEach(() => {
  delete window.llp;
  useLive.setState({state: null});
});

it('keeps the legacy whole-message clear without clearing unrelated valid items', () => {
  const send = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  const state = emptyLiveState();
  useLive.setState({
    state: {
      ...state,
      layers: {
        ...state.layers,
        message: {messageId: 'legacy', text: 'Invented'},
      },
    },
  });
  dismissMessage('legacy');
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'layer.clear.toggle',
    target: 'message',
  });
  send.mockClear();
  useLive.setState({
    state: {
      ...state,
      layers: {
        ...state.layers,
        message: {
          messageId: 'legacy',
          text: 'Invented',
          items: [1, 2].map(number => ({
            messageId: createMessageId(
              `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
            ),
            text: 'Invented',
            targets: 'all',
            excludedTargets: [],
            startedAt: 0,
            expiresAt: null,
          })),
        },
      },
    },
  });
  dismissMessage('legacy');
  expect(send).not.toHaveBeenCalled();
});
