import {cleanup, fireEvent, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  BROADCAST_SCREEN,
  MAIN_SCREEN,
  STAGE_SCREEN,
} from '@fixtures/core/screenIds';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {emptyLiveState} from '@core/schema/live/live';
import {renderWithScreenSummaries as render} from '@fixtures/renderer/platform/screenSummaries';
import {PreviewPanel} from '@renderer/features/presentation/PreviewPanel';
import {usePreview} from '@renderer/session/preview';
import {useLive} from '@renderer/session/live';

const stop = vi.fn();
const capture = vi.fn();
const source = vi.fn();

beforeEach(() => {
  stop.mockReset();
  source.mockReset().mockResolvedValue('AAAAAAAAAAAAAAAAAAAAAA==');
  capture.mockReset().mockImplementation(async () => {
    const track = {stop, onended: null};
    return {getTracks: () => [track], getVideoTracks: () => [track]};
  });
  window.llp = mockLlpApi({output: {previewSource: source}});
  vi.stubGlobal('navigator', {mediaDevices: {getUserMedia: capture}});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  useLive.setState({
    state: {
      ...emptyLiveState(),
      outputs: {
        [MAIN_SCREEN]: true,
        [STAGE_SCREEN]: true,
        [BROADCAST_SCREEN]: true,
      },
    },
  });
  usePreview.setState({largeScreenId: MAIN_SCREEN, visible: true});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.llp;
  useLive.setState({state: null});
});

describe('PreviewPanel mirror lifecycle', () => {
  it('opens one stream per screen and keeps them when the main screen changes', async () => {
    const {container, unmount} = render(<PreviewPanel />);
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(3));
    const mirrors = [...container.querySelectorAll('video')];
    expect(mirrors).toHaveLength(3);
    const tile = container.querySelector<HTMLButtonElement>(
      '[data-preview-slot]',
    );
    if (tile === null) throw Error('Missing preview tile');
    fireEvent.click(tile);
    expect([...container.querySelectorAll('video')]).toEqual(mirrors);
    expect(capture).toHaveBeenCalledTimes(3);
    expect(stop).not.toHaveBeenCalled();
    unmount();
    expect(stop).toHaveBeenCalledTimes(3);
  });

  it('does not start a mirror for an inactive screen', async () => {
    const state = useLive.getState().state;
    if (!state) throw new Error('Missing live state');
    useLive.setState({
      state: {...state, outputs: {...state.outputs, [BROADCAST_SCREEN]: false}},
    });
    const {container} = render(<PreviewPanel />);
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(2));
    expect(
      container.querySelector(`[data-screen="${BROADCAST_SCREEN}"] video`),
    ).toBeNull();
  });
});
