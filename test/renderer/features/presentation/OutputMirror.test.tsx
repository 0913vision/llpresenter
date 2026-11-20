import {act, cleanup, render, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
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
  it('receives a relayed frame without opening a second capture', async () => {
    const capture = vi.fn();
    const listener: {current?: (frame: PreviewFrame) => void} = {};
    const control = vi.fn();
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({putImageData: vi.fn()}),
    });
    vi.stubGlobal('ImageData', vi.fn());
    vi.stubGlobal('navigator', {mediaDevices: {getUserMedia: capture}});
    vi.stubGlobal(
      'llp',
      mockLlpApi({
        output: {
          previewSource: async () => 'relay',
          previewControl: control,
          subscribePreviewFrame: next => {
            listener.current = next;
            return () => undefined;
          },
        },
      }),
    );
    const view = render(
      <OutputMirror screenId="one" fallback={<span>still preview</span>} />,
    );
    expect(view.getByText('still preview')).toBeDefined();
    await waitFor(() => expect(listener.current).toBeDefined());
    act(() =>
      listener.current?.({
        screenId: 'one',
        frame: new Uint8Array(640 * 360 * 4),
      }),
    );
    expect(view.container.querySelector('canvas')?.hidden).toBe(false);
    expect(view.queryByText('still preview')).toBeNull();
    expect(capture).not.toHaveBeenCalled();
    expect(control).toHaveBeenCalledWith({screenId: 'one', action: 'ack'});
  });
  it('relays frames from the existing stream when another window requests them', async () => {
    const originalRequest = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      'requestVideoFrameCallback',
    );
    const originalCancel = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      'cancelVideoFrameCallback',
    );
    const callback: {current?: VideoFrameRequestCallback} = {};
    Object.defineProperty(
      HTMLVideoElement.prototype,
      'requestVideoFrameCallback',
      {
        configurable: true,
        value: (next: VideoFrameRequestCallback) => {
          callback.current = next;
          return 1;
        },
      },
    );
    Object.defineProperty(
      HTMLVideoElement.prototype,
      'cancelVideoFrameCallback',
      {configurable: true, value: vi.fn()},
    );
    onTestFinished(() => {
      if (originalRequest) {
        Object.defineProperty(
          HTMLVideoElement.prototype,
          'requestVideoFrameCallback',
          originalRequest,
        );
      } else {
        Reflect.deleteProperty(
          HTMLVideoElement.prototype,
          'requestVideoFrameCallback',
        );
      }
      if (originalCancel) {
        Object.defineProperty(
          HTMLVideoElement.prototype,
          'cancelVideoFrameCallback',
          originalCancel,
        );
      } else {
        Reflect.deleteProperty(
          HTMLVideoElement.prototype,
          'cancelVideoFrameCallback',
        );
      }
    });
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(
      640,
    );
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(
      360,
    );
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: () => ({data: new Uint8ClampedArray(640 * 360 * 4)}),
      }),
    });
    const track = {stop: vi.fn(), onended: null};
    const capture = vi.fn().mockResolvedValue({
      getTracks: () => [track],
      getVideoTracks: () => [track],
    });
    vi.stubGlobal('navigator', {mediaDevices: {getUserMedia: capture}});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const relay: {
      current?: (value: {screenId: string; enabled: boolean}) => void;
    } = {};
    const publish = vi.fn<(value: PreviewFrame) => void>();
    vi.stubGlobal(
      'llp',
      mockLlpApi({
        output: {
          previewSource: async () => 'AAAAAAAAAAAAAAAAAAAAAA==',
          subscribePreviewRelay: listener => {
            relay.current = listener;
            return () => undefined;
          },
          publishPreview: publish,
        },
      }),
    );
    render(<OutputMirror screenId="one" />);
    await waitFor(() => expect(capture).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(document.querySelector('video')?.srcObject).toBeTruthy(),
    );
    act(() => relay.current?.({screenId: 'one', enabled: true}));
    expect(publish).toHaveBeenCalledOnce();
    expect(callback.current).toBeDefined();
    const draw = callback.current;
    if (!draw) throw new Error('Missing video callback');
    act(() => {
      Reflect.apply(draw, undefined, [100, {}]);
    });
    expect(publish).toHaveBeenCalledOnce();
    expect(publish.mock.calls[0]?.[0]).toMatchObject({screenId: 'one'});
    expect(capture).toHaveBeenCalledOnce();
  });
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
    const callback: {current?: VideoFrameRequestCallback} = {};
    const originalRequest = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      'requestVideoFrameCallback',
    );
    const originalCancel = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      'cancelVideoFrameCallback',
    );
    Object.defineProperty(
      HTMLVideoElement.prototype,
      'requestVideoFrameCallback',
      {
        configurable: true,
        value: (next: VideoFrameRequestCallback) => {
          callback.current = next;
          return 1;
        },
      },
    );
    Object.defineProperty(
      HTMLVideoElement.prototype,
      'cancelVideoFrameCallback',
      {configurable: true, value: vi.fn()},
    );
    onTestFinished(() => {
      if (originalRequest) {
        Object.defineProperty(
          HTMLVideoElement.prototype,
          'requestVideoFrameCallback',
          originalRequest,
        );
      } else {
        Reflect.deleteProperty(
          HTMLVideoElement.prototype,
          'requestVideoFrameCallback',
        );
      }
      if (originalCancel) {
        Object.defineProperty(
          HTMLVideoElement.prototype,
          'cancelVideoFrameCallback',
          originalCancel,
        );
      } else {
        Reflect.deleteProperty(
          HTMLVideoElement.prototype,
          'cancelVideoFrameCallback',
        );
      }
    });

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
    expect(capture).toHaveBeenCalledWith({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: 'AAAAAAAAAAAAAAAAAAAAAA==',
          maxFrameRate: 10,
          maxWidth: 640,
          maxHeight: 360,
        },
      },
    });
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
    await waitFor(() => expect(callback.current).toBeDefined());
    expect(view.container.querySelector('canvas')?.hidden).toBe(false);
    expect(view.container.querySelector('video')?.hidden).toBe(true);
    act(() =>
      callback.current?.(0, {
        presentationTime: 0,
        expectedDisplayTime: 0,
        width: 640,
        height: 360,
        mediaTime: 0,
        presentedFrames: 1,
      }),
    );
    expect(view.container.querySelector('canvas')?.hidden).toBe(true);
    expect(view.container.querySelector('video')?.hidden).toBe(false);
    view.unmount();
    expect(control).toHaveBeenCalledWith({screenId: 'one', action: 'stop'});
  });
  it.each(['prep', 'screens'])(
    'retains the last native frame during show to %s and back',
    async () => {
      const listener: {current?: (frame: PreviewFrame) => void} = {};
      const control =
        vi.fn<(value: {screenId: string; action: string}) => void>();
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: () => ({putImageData: vi.fn()}),
      });
      vi.stubGlobal('ImageData', vi.fn());
      vi.stubGlobal(
        'llp',
        mockLlpApi({
          output: {
            previewSource: async () => 'relay',
            previewControl: control,
            subscribePreviewFrame: next => {
              listener.current = next;
              return () => {
                listener.current = undefined;
              };
            },
          },
        }),
      );
      const frame = document.createElement('div');
      frame.dataset['workspaceFrame'] = 'show';
      frame.setAttribute('aria-hidden', 'false');
      document.body.append(frame);
      const view = render(<OutputMirror screenId="one" />, {container: frame});
      await waitFor(() => expect(listener.current).toBeDefined());
      act(() =>
        listener.current?.({
          screenId: 'one',
          frame: new Uint8Array(640 * 360 * 4),
        }),
      );
      const canvas = view.container.querySelector('canvas');
      const video = view.container.querySelector('video');
      expect(canvas?.hidden).toBe(false);
      expect(video?.hidden).toBe(true);
      frame.setAttribute('aria-hidden', 'true');
      await waitFor(() =>
        expect(control).toHaveBeenCalledWith({screenId: 'one', action: 'stop'}),
      );
      expect(canvas?.hidden).toBe(false);
      expect(video?.hidden).toBe(true);
      frame.setAttribute('aria-hidden', 'false');
      await waitFor(() =>
        expect(
          control.mock.calls.filter(([value]) => value.action === 'start'),
        ).toHaveLength(2),
      );
      expect(canvas?.hidden).toBe(false);
      expect(video?.hidden).toBe(true);
      view.unmount();
      frame.remove();
    },
  );
  it('keeps the last video frame visible until the resumed stream paints', async () => {
    const frames: VideoFrameRequestCallback[] = [];
    const originalRequest = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      'requestVideoFrameCallback',
    );
    const originalCancel = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      'cancelVideoFrameCallback',
    );
    Object.defineProperty(
      HTMLVideoElement.prototype,
      'requestVideoFrameCallback',
      {
        configurable: true,
        value: (next: VideoFrameRequestCallback) => {
          frames.push(next);
          return frames.length;
        },
      },
    );
    Object.defineProperty(
      HTMLVideoElement.prototype,
      'cancelVideoFrameCallback',
      {configurable: true, value: vi.fn()},
    );
    onTestFinished(() => {
      if (originalRequest) {
        Object.defineProperty(
          HTMLVideoElement.prototype,
          'requestVideoFrameCallback',
          originalRequest,
        );
      } else {
        Reflect.deleteProperty(
          HTMLVideoElement.prototype,
          'requestVideoFrameCallback',
        );
      }
      if (originalCancel) {
        Object.defineProperty(
          HTMLVideoElement.prototype,
          'cancelVideoFrameCallback',
          originalCancel,
        );
      } else {
        Reflect.deleteProperty(
          HTMLVideoElement.prototype,
          'cancelVideoFrameCallback',
        );
      }
    });
    const draw = vi.fn();
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({drawImage: draw}),
    });
    const stop = vi.fn();
    const track = {stop, onended: null};
    const capture = vi.fn().mockResolvedValue({
      getTracks: () => [track],
      getVideoTracks: () => [track],
    });
    vi.stubGlobal('navigator', {mediaDevices: {getUserMedia: capture}});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.stubGlobal(
      'llp',
      mockLlpApi({
        output: {previewSource: async () => 'AAAAAAAAAAAAAAAAAAAAAA=='},
      }),
    );
    const frame = document.createElement('div');
    frame.dataset['workspaceFrame'] = 'show';
    frame.setAttribute('aria-hidden', 'false');
    document.body.append(frame);
    const view = render(<OutputMirror screenId="one" />, {container: frame});
    await waitFor(() => expect(capture).toHaveBeenCalledOnce());
    const video = view.container.querySelector('video');
    const canvas = view.container.querySelector('canvas');
    if (!video || !canvas) throw Error('Missing preview surfaces');
    Object.defineProperty(video, 'videoWidth', {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(video, 'videoHeight', {
      configurable: true,
      value: 360,
    });
    frame.setAttribute('aria-hidden', 'true');
    await waitFor(() => expect(stop).toHaveBeenCalledOnce());
    expect(draw).toHaveBeenCalledWith(video, 0, 0, 640, 360);
    expect(canvas.hidden).toBe(false);
    expect(video.hidden).toBe(true);
    frame.setAttribute('aria-hidden', 'false');
    await waitFor(() => expect(frames).toHaveLength(1));
    expect(canvas.hidden).toBe(false);
    expect(video.hidden).toBe(true);
    act(() =>
      frames[0]?.(0, {
        presentationTime: 0,
        expectedDisplayTime: 0,
        width: 640,
        height: 360,
        mediaTime: 0,
        presentedFrames: 1,
      }),
    );
    expect(canvas.hidden).toBe(true);
    expect(video.hidden).toBe(false);
    view.unmount();
    frame.remove();
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
