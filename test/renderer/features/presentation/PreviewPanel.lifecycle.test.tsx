import {cleanup, fireEvent, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {MAIN_SCREEN} from '@fixtures/core/screenIds';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {renderWithScreenSummaries as render} from '@fixtures/renderer/platform/screenSummaries';
import {PreviewPanel} from '@renderer/features/presentation/PreviewPanel';
import {usePreview} from '@renderer/session/preview';

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
  usePreview.setState({largeScreenId: MAIN_SCREEN, visible: true});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.llp;
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
});
