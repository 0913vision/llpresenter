import {afterEach, describe, expect, it, vi} from 'vitest';
import type {PictureRequest} from '@core/schema/picture';
import {emptyLayers} from '@core/live/state';
import {createScreenId, createThemeId} from '@core/schema/ids';

const mocks = vi.hoisted(() => ({
  startPainting: vi.fn(),
  capturePage: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: class {
    readonly webContents = {
      setFrameRate: vi.fn(),
      setAudioMuted: vi.fn(),
      startPainting: mocks.startPainting,
      stopPainting: vi.fn(),
      isDestroyed: () => false,
      executeJavaScript: vi.fn().mockResolvedValue(undefined),
      capturePage: mocks.capturePage,
    };
    setMinimumSize(): void {}
    setContentSize(): void {}
    isDestroyed(): boolean {
      return false;
    }
    destroy(): void {}
  },
}));
vi.mock('@main/windows/page', () => ({
  blockNavigation: () => undefined,
  preloadPath: 'preload.js',
  startLoading: async () => undefined,
}));

const {PicturePainter} = await import('@main/windows/painter');
const {setTransitionActivity} =
  await import('@main/outputs/transitionActivity');
const transition = Symbol();
const screen = createScreenId('00000000-0000-4000-8000-000000000001');
const request: PictureRequest = {
  inputs: '',
  spec: {
    layers: emptyLayers(),
    appearance: {
      screen: {id: screen, kind: 'audience'},
      theme: {
        themeId: createThemeId('00000000-0000-4000-8000-000000000002'),
        revision: 0,
        missing: [],
        item: null,
        sourceScreenId: screen,
        layout: {mode: {kind: 'own'}, elements: []},
        emptyColor: '#000000',
      },
      background: '#000000',
      checker: false,
    },
  },
};

afterEach(() => {
  setTransitionActivity(transition, false);
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('picture painter', () => {
  it('paces picture work during a presenter transition and resumes immediately afterward', async () => {
    vi.useFakeTimers();
    mocks.capturePage.mockResolvedValue({
      isEmpty: () => false,
      toJPEG: () => Buffer.from('picture'),
    });
    const painter = new PicturePainter();
    setTransitionActivity(transition, true);
    const during = painter.paint(request);
    await vi.advanceTimersByTimeAsync(79);
    expect(mocks.startPainting).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(during).resolves.toEqual(Buffer.from('picture'));
    setTransitionActivity(transition, false);
    await expect(painter.paint(request)).resolves.toEqual(
      Buffer.from('picture'),
    );
    expect(mocks.startPainting).toHaveBeenCalledTimes(2);
    painter.dispose();
  });
});
