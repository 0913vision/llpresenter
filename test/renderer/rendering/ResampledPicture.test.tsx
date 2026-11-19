import {act, cleanup, render} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {ResampledPicture} from '@renderer/rendering/pictures/ResampledPicture';

const idle = new Map<number, IdleRequestCallback>();
let nextIdleId = 0;
const requestIdle = vi.fn<typeof requestIdleCallback>(callback => {
  const id = ++nextIdleId;
  idle.set(id, callback);
  return id;
});
const cancelIdle = vi.fn((id: number) => idle.delete(id));
const resizeImage = vi.fn<typeof createImageBitmap>();
let width: number;

class Observer {
  static active = new Set<Observer>();
  constructor(private readonly resize: () => void) {}
  observe(): void {
    Observer.active.add(this);
  }
  disconnect(): void {
    Observer.active.delete(this);
  }
  static report(): void {
    for (const observer of this.active) observer.resize();
  }
}

function tiles(sources: readonly HTMLCanvasElement[]) {
  return sources.map(source => (
    <div key={source.id}>
      <ResampledPicture source={source} prepared={undefined} />
    </div>
  ));
}

function source(id: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.id = id;
  return canvas;
}

async function runIdle(): Promise<void> {
  await act(async () => {
    const next = idle.entries().next();
    if (next.done) throw Error('Expected an idle resize');
    const [id, callback] = next.value;
    idle.delete(id);
    callback({didTimeout: true, timeRemaining: () => 0});
  });
}

beforeEach(() => {
  idle.clear();
  requestIdle.mockClear();
  cancelIdle.mockClear();
  resizeImage.mockReset();
  resizeImage.mockRejectedValue(Error('Stop before encoding'));
  width = 100;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => DOMRect.fromRect({width, height: 50}),
  );
  vi.stubGlobal('ResizeObserver', Observer);
  vi.stubGlobal('devicePixelRatio', 2);
  vi.stubGlobal('requestIdleCallback', requestIdle);
  vi.stubGlobal('cancelIdleCallback', cancelIdle);
  vi.stubGlobal('createImageBitmap', resizeImage);
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext(): object {
        return {};
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('drops scrolled-out tiles before idle and cancels the callback when the last tile leaves', async () => {
  const kept = source('kept');
  const {rerender, unmount} = render(tiles([kept]));
  for (let index = 0; index < 20; index++) {
    rerender(tiles([kept, source(`scroll-${index}`)]));
  }
  rerender(tiles([kept]));

  expect(requestIdle).toHaveBeenCalledTimes(1);
  expect(requestIdle).toHaveBeenCalledWith(expect.any(Function), {
    timeout: 200,
  });
  await runIdle();
  expect(resizeImage).toHaveBeenCalledExactlyOnceWith(kept, {
    resizeWidth: 200,
    resizeHeight: 100,
    resizeQuality: 'high',
  });
  expect(idle.size).toBe(0);

  rerender(tiles([source('last')]));
  expect(idle.size).toBe(1);
  unmount();
  expect(cancelIdle).toHaveBeenCalledTimes(1);
  expect(idle.size).toBe(0);
});

it('keeps only the latest queued size per tile while a resize is running', async () => {
  const first = source('first');
  const second = source('second');
  let rejectResize: (error: Error) => void = () => undefined;
  resizeImage.mockReturnValueOnce(
    new Promise<ImageBitmap>((_, reject) => {
      rejectResize = reject;
    }),
  );
  const {rerender} = render(tiles([first, second]));
  await runIdle();

  for (const nextWidth of [110, 120, 130]) {
    width = nextWidth;
    act(() => Observer.report());
  }
  rerender(tiles([second]));
  expect(idle.size).toBe(0);
  expect(resizeImage).toHaveBeenCalledTimes(1);

  await act(async () => rejectResize(Error('Release first resize')));
  await runIdle();
  expect(resizeImage).toHaveBeenCalledTimes(2);
  expect(resizeImage).toHaveBeenLastCalledWith(second, {
    resizeWidth: 260,
    resizeHeight: 100,
    resizeQuality: 'high',
  });
  expect(idle.size).toBe(0);
});
