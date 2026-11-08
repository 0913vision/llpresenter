import {beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers} from '@core/live/state';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import type {RenderLayerOptions} from '@renderer/rendering/layer';
import {backgroundLayer} from '@renderer/rendering/layers/background';

const mocks = vi.hoisted(() => {
  const views: Array<{
    show: ReturnType<typeof vi.fn>;
    setDissolveMs: ReturnType<typeof vi.fn>;
    hold: ReturnType<typeof vi.fn>;
    ready: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }> = [];
  return {views};
});

vi.mock('@renderer/rendering/backgroundLayer', () => ({
  BackgroundLayerView: class MockBackgroundLayerView {
    readonly show = vi.fn();
    readonly setDissolveMs = vi.fn();
    readonly hold = vi.fn();
    readonly ready = vi.fn(() => true);
    readonly dispose = vi.fn();
    constructor() {
      mocks.views.push(this);
    }
  },
}));

beforeEach(() => {
  mocks.views.length = 0;
});

const options: RenderLayerOptions = {
  textStyle: DEFAULT_TEXT_STYLE,
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
    expect(view.show).toHaveBeenCalledExactlyOnceWith(MEDIA, false, undefined);
    expect(view.hold).not.toHaveBeenCalled();
  });

  it.each([true, false])('passes standby=%s to the media player', standby => {
    const {layer, view} = create();
    layer.render({...emptyLayers(), media: MEDIA}, {standby});
    expect(view.show).toHaveBeenCalledExactlyOnceWith(
      MEDIA,
      undefined,
      standby,
    );
  });

  it('gives the view the 배경 전환 time of the frame, and a cut for 0', () => {
    const {layer, view} = create();
    const times = {slideMs: 200, backgroundMs: 1000};
    layer.render({...emptyLayers(), media: MEDIA}, {transitionTimes: times});
    expect(view.setDissolveMs).toHaveBeenLastCalledWith(1000);
    layer.render(
      {...emptyLayers(), media: MEDIA},
      {transitionTimes: {...times, backgroundMs: 0}},
    );
    expect(view.setDissolveMs).toHaveBeenLastCalledWith(0);
  });

  it('leaves the default time when the frame has no times', () => {
    const {layer, view} = create();
    layer.render({...emptyLayers(), media: MEDIA}, {});
    expect(view.setDissolveMs).not.toHaveBeenCalled();
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
