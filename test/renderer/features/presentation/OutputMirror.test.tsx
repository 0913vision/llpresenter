import {act, cleanup, render, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {OutputMirror} from '@renderer/features/presentation/OutputMirror';
import type {PreviewFrame} from '@core/schema/previewMirror';

const canvasContext = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  'getContext',
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (canvasContext !== undefined) {
    Object.defineProperty(
      HTMLCanvasElement.prototype,
      'getContext',
      canvasContext,
    );
  }
});

describe('output mirror', () => {
  it('crops the presenter frame to the actual output aspect ratio', () => {
    vi.stubGlobal('llp', mockLlpApi());
    const view = render(
      <OutputMirror screenId="one" cropSize={{width: 1024, height: 768}} />,
    );
    const canvas = view.container.querySelector('canvas');
    expect(canvas?.style.width).toBe(`${(1920 / 1440) * 100}%`);
    expect(canvas?.style.left).toBe(`${(-240 / 1440) * 100}%`);
    expect(canvas?.style.height).toBe('100%');
  });
  it('switches to the presenter frame, acknowledges it, and resumes the output stream when it ends', async () => {
    const stop = vi.fn();
    const track = {stop, onended: null};
    const capture = vi.fn().mockResolvedValue({
      getTracks: () => [track],
      getVideoTracks: () => [track],
    });
    const draw = vi.fn();
    const control = vi.fn();
    const listener: {current: ((frame: PreviewFrame) => void) | undefined} = {
      current: undefined,
    };
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({putImageData: draw}),
    });
    vi.stubGlobal('ImageData', vi.fn());
    vi.stubGlobal('navigator', {mediaDevices: {getUserMedia: capture}});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.stubGlobal(
      'llp',
      mockLlpApi({
        output: {
          previewSource: async () => 'AAAAAAAAAAAAAAAAAAAAAA==',
          previewControl: control,
          subscribePreviewFrame: callback => {
            listener.current = callback;
            return () => {
              listener.current = undefined;
            };
          },
        },
      }),
    );
    const view = render(<OutputMirror screenId="one" />);
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(control).toHaveBeenCalledWith({screenId: 'one', action: 'start'});
    act(() =>
      listener.current?.({
        screenId: 'one',
        frame: new Uint8Array(640 * 360 * 4),
      }),
    );
    expect(draw).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(control).toHaveBeenCalledWith({screenId: 'one', action: 'ack'});
    expect(view.container.querySelector('canvas')?.hidden).toBe(false);
    expect(view.container.querySelector('video')?.hidden).toBe(true);
    act(() => listener.current?.({screenId: 'one', frame: null}));
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(2));
    expect(view.container.querySelector('canvas')?.hidden).toBe(true);
    view.unmount();
    expect(control).toHaveBeenCalledWith({screenId: 'one', action: 'stop'});
  });
  it('stops capture while the workspace is hidden and reconnects when shown', async () => {
    const stop = vi.fn();
    const track = {stop, onended: null};
    const stream = {getTracks: () => [track], getVideoTracks: () => [track]};
    const capture = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal(
      'llp',
      mockLlpApi({
        output: {previewSource: async () => 'AAAAAAAAAAAAAAAAAAAAAA=='},
      }),
    );
    vi.stubGlobal('navigator', {mediaDevices: {getUserMedia: capture}});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const frame = document.createElement('div');
    frame.dataset['workspaceFrame'] = 'show';
    frame.setAttribute('aria-hidden', 'false');
    document.body.append(frame);
    const view = render(<OutputMirror screenId="one" />, {container: frame});
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    frame.setAttribute('aria-hidden', 'true');
    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
    frame.setAttribute('aria-hidden', 'false');
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(2));
    view.unmount();
    expect(stop).toHaveBeenCalledTimes(2);
    frame.remove();
  });
});
