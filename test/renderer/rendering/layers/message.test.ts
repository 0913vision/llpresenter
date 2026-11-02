import {expect, it, vi} from 'vitest';
import {DEFAULT_TEXT_STYLE, type TextStyle} from '@core/themes/textStyle';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/messages';
import {classes} from '@renderer/rendering/classes';
import {messageLayer} from '@renderer/rendering/layers/message';
import type {RenderFrame, RenderLayerOptions} from '@renderer/rendering/layer';

const LAYERS: LiveLayers = {
  ...emptyLayers(),
  message: {messageId: 'invented', text: 'Welcome'},
};

const OPTIONS: RenderLayerOptions = {
  textStyle: DEFAULT_TEXT_STYLE,
  mediaUrl: mediaId => `https://media.test/${mediaId}.mp4`,
  onError: vi.fn(),
};

function setUp() {
  const parent = document.createElement('div');
  const layer = messageLayer.create(parent, OPTIONS);
  const block = () =>
    parent.querySelector<HTMLElement>(
      `.${classes.page}.${classes.shown} .${classes.block}`,
    );
  return {layer, block};
}

it('redraws a showing message when its screen picks another style', () => {
  const {layer, block} = setUp();
  const frame = (messageStyle: TextStyle): RenderFrame => ({
    messageStyle,
  });
  layer.render(LAYERS, frame(DEFAULT_MESSAGE_STYLE));
  expect(block()?.style.color).toBe('rgb(255, 255, 255)');

  layer.render(LAYERS, frame({...DEFAULT_MESSAGE_STYLE, color: '#00FF00'}));

  expect(block()?.textContent).toBe('Welcome');
  expect(block()?.style.color).toBe('rgb(0, 255, 0)');
});
