import {expect, it, vi} from 'vitest';
import {DEFAULT_TEXT_STYLE, type TextStyle} from '@core/themes/textStyle';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/messages';
import {MESSAGE_BAND} from '@core/screens/messageStyle';
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
  const band = () =>
    parent.querySelector<HTMLElement>(`.${classes.band}.${classes.shown}`);
  return {layer, block, band};
}

it('draws a message in the built-in 기본 band, not in the lyric style', () => {
  const {layer, block, band} = setUp();
  layer.render(LAYERS, {
    messageStyle: DEFAULT_MESSAGE_STYLE,
    messageBand: MESSAGE_BAND,
  });
  expect(band()?.textContent).toBe('Welcome');
  expect(band()?.style.fontWeight).toBe('600');
  expect(band()?.style.fontSize).toBe('54px');
  expect(band()?.style.padding).toBe('17.28px 76.8px');
  expect(band()?.style.color).toBe('rgb(255, 255, 255)');
  expect(band()?.style.backgroundColor).toContain('72%');
  expect(
    band()
      ?.querySelector<HTMLElement>(`.${classes.bandText}`)
      ?.style.getPropertyValue('-webkit-line-clamp'),
  ).toBe('2');
  expect(block()).toBeNull();
});

it('draws the band opaque when the frame says the screen background is chroma', () => {
  const {layer, band} = setUp();
  layer.render(LAYERS, {
    messageStyle: DEFAULT_MESSAGE_STYLE,
    messageBand: {
      ...MESSAGE_BAND,
      background: {color: '#000000', opacity: 100},
    },
  });
  expect(band()?.style.backgroundColor).toContain('100%');
  layer.render(LAYERS, {
    messageStyle: DEFAULT_MESSAGE_STYLE,
    messageBand: MESSAGE_BAND,
  });
  expect(band()?.style.backgroundColor).toContain('72%');
});

it('draws a message in the band when there is no frame or no chosen style', () => {
  const {layer, band, block} = setUp();
  layer.render(LAYERS);
  expect(band()?.textContent).toBe('Welcome');
  expect(block()).toBeNull();
});

it('scales the band with the screen and hides it when the message ends', () => {
  const {layer, band} = setUp();
  layer.render(LAYERS);
  layer.rescale?.(0.5);
  expect(band()?.style.fontSize).toBe('27px');
  expect(band()?.style.padding).toBe('8.64px 38.4px');
  layer.render(emptyLayers());
  expect(band()).toBeNull();
});

it('redraws a showing message when its screen picks another style', () => {
  const {layer, block, band} = setUp();
  const frame = (messageStyle: TextStyle): RenderFrame => ({
    messageStyle,
  });
  layer.render(LAYERS, frame(DEFAULT_MESSAGE_STYLE));
  expect(band()).toBeNull();
  expect(block()?.style.color).toBe('rgb(255, 255, 255)');

  layer.render(LAYERS, frame({...DEFAULT_MESSAGE_STYLE, color: '#00FF00'}));

  expect(block()?.textContent).toBe('Welcome');
  expect(block()?.style.color).toBe('rgb(0, 255, 0)');
  expect(band()).toBeNull();
});
