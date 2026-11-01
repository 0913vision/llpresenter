import {describe, expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {DEFAULT_LYRIC_STYLE} from '@core/looks/lyricStyle';
import type {RenderLayerOptions} from '../layer';
import {backgroundLayer} from './background';

const mocks = vi.hoisted(() => {
  const views: Array<{
    show: ReturnType<typeof vi.fn>;
    hold: ReturnType<typeof vi.fn>;
    ready: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }> = [];
  return {views};
});

vi.mock('../backgroundLayer', () => ({
  BackgroundLayerView: class MockBackgroundLayerView {
    readonly show = vi.fn();
    readonly hold = vi.fn();
    readonly ready = vi.fn(() => true);
    readonly dispose = vi.fn();
    constructor() {
      mocks.views.push(this);
    }
  },
}));

const options: RenderLayerOptions = {
  lyricStyle: DEFAULT_LYRIC_STYLE,
  mediaUrl: mediaId => `https://media.test/${mediaId}.mp4`,
  onError: vi.fn(),
};

function create() {
  const layer = backgroundLayer.create(document.createElement('div'), options);
  const view = mocks.views.at(-1);
  if (view === undefined) throw new Error('no background view was created');
  return {layer, view};
}

const MEDIA = {mediaId: 'sunset', loop: true, startedAt: 0};

describe('background layer', () => {
  it('shows the media layer, with the frame transitions', () => {
    const {layer, view} = create();
    layer.render({...emptyLayers(), media: MEDIA}, {transitions: false});
    expect(view.show).toHaveBeenCalledExactlyOnceWith(MEDIA, false);
    expect(view.hold).not.toHaveBeenCalled();
  });

  it('holds the last picture instead of changing it while the frame clears the media', () => {
    const {layer, view} = create();
    layer.render(emptyLayers(), {clearOpacity: {media: 0.5}});
    expect(view.hold).toHaveBeenCalledOnce();
    expect(view.show).not.toHaveBeenCalled();
  });

  it('answers whether the picture is ready from its view, and disposes it', () => {
    const {layer, view} = create();
    expect(layer.ready?.()).toBe(true);
    view.ready.mockReturnValue(false);
    expect(layer.ready?.()).toBe(false);
    layer.dispose();
    expect(view.dispose).toHaveBeenCalledOnce();
  });
});
