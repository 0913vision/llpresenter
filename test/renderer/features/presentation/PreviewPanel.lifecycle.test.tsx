import {cleanup, fireEvent} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  BROADCAST_SCREEN,
  MAIN_SCREEN,
  STAGE_SCREEN,
} from '@fixtures/core/screenIds';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {emptyLiveState} from '@core/live/state';
import {renderWithScreenSummaries as render} from '@fixtures/renderer/platform/screenSummaries';
import {PreviewPanel} from '@renderer/features/presentation/PreviewPanel';
import {usePreview} from '@renderer/session/preview';
import {useLive} from '@renderer/session/live';

const stop = vi.fn();
const capture = vi.fn();
const source = vi.fn();
const subscribe = vi.fn(() => () => undefined);
const control = vi.fn();

beforeEach(() => {
  stop.mockReset();
  source.mockReset().mockResolvedValue('AAAAAAAAAAAAAAAAAAAAAA==');
  subscribe.mockClear();
  control.mockClear();
  capture.mockReset().mockImplementation(async () => {
    const track = {stop, onended: null};
    return {getTracks: () => [track], getVideoTracks: () => [track]};
  });
  window.llp = mockLlpApi({
    output: {
      previewSource: source,
      subscribePreviewFrame: subscribe,
      previewControl: control,
    },
  });
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
  it('does not capture any running output, including after a screen swap', () => {
    const {container, unmount} = render(<PreviewPanel />);
    expect(source).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(control).not.toHaveBeenCalled();
    expect(container.querySelectorAll('video')).toHaveLength(0);
    const tile = container.querySelector<HTMLButtonElement>(
      '[data-preview-slot]',
    );
    if (tile === null) throw Error('Missing preview tile');
    fireEvent.click(tile);
    expect(source).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(control).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    unmount();
    expect(stop).not.toHaveBeenCalled();
  });

  it('does not capture with an inactive screen either', () => {
    const state = useLive.getState().state;
    if (!state) throw new Error('Missing live state');
    useLive.setState({
      state: {...state, outputs: {...state.outputs, [BROADCAST_SCREEN]: false}},
    });
    const {container} = render(<PreviewPanel />);
    expect(source).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(
      container.querySelector(`[data-screen="${BROADCAST_SCREEN}"] video`),
    ).toBeNull();
  });
});
