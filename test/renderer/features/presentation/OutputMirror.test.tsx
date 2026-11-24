import {act, cleanup, render, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {OutputMirror} from '@renderer/features/presentation/OutputMirror';
import type {PreviewFrame} from '@core/schema/live/previewMirror';

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
    const view = render(<OutputMirror screenId="one" />);
    await waitFor(() => expect(listener.current).toBeDefined());
    act(() =>
      listener.current?.({
        screenId: 'one',
        frame: new Uint8Array(640 * 360 * 4),
      }),
    );
    expect(view.container.querySelector('canvas')?.hidden).toBe(false);
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
    // NOTE(0913vision): Keep the frame until the replacement stream paints.
    expect(view.container.querySelector('canvas')?.hidden).toBe(false);
    view.unmount();
    expect(control).toHaveBeenCalledWith({screenId: 'one', action: 'stop'});
  });
  it('keeps receiving native frames while the workspace is hidden', async () => {
    const listener: {current?: (frame: PreviewFrame) => void} = {};
    const control = vi.fn();
    const draw = vi.fn();
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({putImageData: draw}),
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
              delete listener.current;
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
    frame.setAttribute('aria-hidden', 'true');
    act(() =>
      listener.current?.({
        screenId: 'one',
        frame: new Uint8Array(640 * 360 * 4),
      }),
    );
    expect(draw).toHaveBeenCalledTimes(2);
    expect(control).not.toHaveBeenCalledWith({screenId: 'one', action: 'stop'});
    expect(view.container.querySelector('canvas')?.hidden).toBe(false);
    frame.setAttribute('aria-hidden', 'false');
    expect(listener.current).toBeDefined();
    expect(view.container.querySelector('canvas')?.hidden).toBe(false);
    expect(view.container.querySelector('video')?.hidden).toBe(true);
    view.unmount();
    frame.remove();
  });
  it('keeps the same capture through workspace switches and stops on minimize', async () => {
    const minimized: {current?: (value: boolean) => void} = {};
    const stop = vi.fn();
    const track = {stop, onended: null};
    const stream = {getTracks: () => [track], getVideoTracks: () => [track]};
    const capture = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal(
      'llp',
      mockLlpApi({
        window: {
          onMinimized: callback => {
            minimized.current = callback;
            return () => undefined;
          },
        },
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
    await waitFor(() =>
      expect(view.container.querySelector('video')?.srcObject).toBe(stream),
    );
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('aria-hidden', 'false');
    expect(stop).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector('video')?.srcObject).toBe(stream);
    act(() => minimized.current?.(true));
    expect(stop).toHaveBeenCalledTimes(1);
    act(() => minimized.current?.(false));
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(2));
    view.unmount();
    expect(stop).toHaveBeenCalledTimes(2);
    frame.remove();
  });
  it('honors minimize events that arrive before the initial state query', async () => {
    const minimized: {current?: (value: boolean) => void} = {};
    let finish: ((value: boolean) => void) | undefined;
    const capture = vi
      .fn()
      .mockResolvedValue({getTracks: () => [], getVideoTracks: () => []});
    vi.stubGlobal('navigator', {mediaDevices: {getUserMedia: capture}});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.stubGlobal(
      'llp',
      mockLlpApi({
        window: {
          minimized: () =>
            new Promise<boolean>(resolve => {
              finish = resolve;
            }),
          onMinimized: callback => {
            minimized.current = callback;
            return () => undefined;
          },
        },
        output: {previewSource: async () => 'AAAAAAAAAAAAAAAAAAAAAA=='},
      }),
    );
    const view = render(<OutputMirror screenId="one" />);
    act(() => minimized.current?.(true));
    await act(async () => finish?.(false));
    expect(capture).not.toHaveBeenCalled();
    act(() => minimized.current?.(false));
    await waitFor(() => expect(capture).toHaveBeenCalledOnce());
    view.unmount();
  });
  it('keeps a capture that finishes while the workspace is hidden', async () => {
    const track = {stop: vi.fn(), onended: null};
    const stream = {getTracks: () => [track], getVideoTracks: () => [track]};
    let finish: ((value: typeof stream) => void) | undefined;
    const capture = vi.fn(
      () =>
        new Promise<typeof stream>(resolve => {
          finish = resolve;
        }),
    );
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
    frame.setAttribute('aria-hidden', 'true');
    await act(async () => finish?.(stream));
    expect(view.container.querySelector('video')?.srcObject).toBe(stream);
    expect(track.stop).not.toHaveBeenCalled();
    frame.setAttribute('aria-hidden', 'false');
    expect(capture).toHaveBeenCalledOnce();
    view.unmount();
    expect(track.stop).toHaveBeenCalledOnce();
    frame.remove();
  });
  it('holds a captured video frame until the stream paints after restore', async () => {
    const minimized: {current?: (value: boolean) => void} = {};
    const callbacks: VideoFrameRequestCallback[] = [];
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
        value: (callback: VideoFrameRequestCallback) => {
          callbacks.push(callback);
          return callbacks.length;
        },
      },
    );
    Object.defineProperty(
      HTMLVideoElement.prototype,
      'cancelVideoFrameCallback',
      {
        configurable: true,
        value: vi.fn(),
      },
    );
    onTestFinished(() => {
      for (const [name, descriptor] of [
        ['requestVideoFrameCallback', originalRequest],
        ['cancelVideoFrameCallback', originalCancel],
      ] as const) {
        if (descriptor === undefined) {
          Reflect.deleteProperty(HTMLVideoElement.prototype, name);
        } else {
          Object.defineProperty(HTMLVideoElement.prototype, name, descriptor);
        }
      }
    });
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(
      640,
    );
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(
      360,
    );
    const draw = vi.fn();
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({drawImage: draw}),
    });
    const track = {stop: vi.fn(), onended: null};
    const capture = vi.fn().mockResolvedValue({
      getTracks: () => [track],
      getVideoTracks: () => [track],
    });
    vi.stubGlobal('navigator', {mediaDevices: {getUserMedia: capture}});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

    vi.stubGlobal(
      'llp',
      mockLlpApi({
        window: {
          onMinimized: callback => {
            minimized.current = callback;
            return () => undefined;
          },
        },
        output: {previewSource: async () => 'AAAAAAAAAAAAAAAAAAAAAA=='},
      }),
    );
    const frame = document.createElement('div');
    frame.dataset['workspaceFrame'] = 'show';
    frame.setAttribute('aria-hidden', 'false');
    document.body.append(frame);
    const view = render(<OutputMirror screenId="one" />, {container: frame});
    await waitFor(() => expect(capture).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(view.container.querySelector('video')?.srcObject).toBeTruthy(),
    );
    act(() => minimized.current?.(true));
    await waitFor(() => expect(draw).toHaveBeenCalledOnce());
    expect(view.container.querySelector('canvas')?.hidden).toBe(false);
    act(() => minimized.current?.(false));
    await waitFor(() => expect(callbacks).toHaveLength(1));
    expect(view.container.querySelector('canvas')?.hidden).toBe(false);
    act(() => {
      const callback = callbacks[0];
      if (callback !== undefined) Reflect.apply(callback, undefined, [0, {}]);
    });
    expect(view.container.querySelector('canvas')?.hidden).toBe(true);
    expect(view.container.querySelector('video')?.hidden).toBe(false);
    view.unmount();
    frame.remove();
  });
});
