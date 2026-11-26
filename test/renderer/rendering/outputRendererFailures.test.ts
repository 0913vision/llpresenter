import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/schema/live/live';
import type {LayerDefinition, RenderLayer} from '@renderer/rendering/layer';

const fake = vi.hoisted(() => {
  const layers: LayerDefinition[] = [];
  return {layers};
});
vi.mock('@renderer/rendering/layers/renderLayers', () => ({
  renderLayers: fake.layers,
}));

function working(kind: string) {
  const view: RenderLayer = {
    render: vi.fn(),
    rescale: vi.fn(),
    dispose: vi.fn(),
  };
  const layer: LayerDefinition = {kind, create: () => view};
  return {layer, view};
}

function options() {
  return {
    mediaUrl: (id: string) => `llp-media://media/${id}`,
    onError: vi.fn<(message: string, error: unknown) => void>(),
    onDrawFailure: vi.fn<(message: string, error: unknown) => void>(),
  };
}

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  document.body.replaceChildren();
});

async function renderer() {
  return (await import('@renderer/rendering/outputRenderer')).OutputRenderer;
}

it('leaves out a layer that can not be made, says why, and draws the others', async () => {
  const failure = new Error('no canvas');
  const props = working('props');
  fake.layers.splice(
    0,
    Infinity,
    {
      kind: 'messages',
      create: () => {
        throw failure;
      },
    },
    props.layer,
  );
  const used = options();
  const OutputRenderer = await renderer();
  const output = new OutputRenderer(document.body, used);
  expect(used.onError).toHaveBeenCalledWith(
    'could not create the messages layer',
    failure,
  );
  expect(used.onDrawFailure).toHaveBeenCalledWith(
    'could not create the messages layer',
    failure,
  );
  expect(document.querySelector('[data-layer="messages"]')).toBeNull();
  output.render(emptyLiveState().layers);
  expect(props.view.render).toHaveBeenCalled();
  output.dispose();
});

it('keeps drawing the other layers when one fails to draw, and says which', async () => {
  const failure = new Error('bad frame');
  const broken = working('messages');
  vi.mocked(broken.view.render).mockImplementation(() => {
    throw failure;
  });
  const props = working('props');
  fake.layers.splice(0, Infinity, broken.layer, props.layer);
  const used = options();
  const OutputRenderer = await renderer();
  const output = new OutputRenderer(document.body, used);
  output.render(emptyLiveState().layers);
  expect(used.onError).toHaveBeenCalledWith(
    'could not draw the messages layer',
    failure,
  );
  expect(props.view.render).toHaveBeenCalled();
  output.dispose();
});

it('draws nothing once it is disposed', async () => {
  const props = working('props');
  fake.layers.splice(0, Infinity, props.layer);
  const OutputRenderer = await renderer();
  const output = new OutputRenderer(document.body, options());
  output.dispose();
  output.dispose();
  output.render(emptyLiveState().layers);
  expect(props.view.render).not.toHaveBeenCalled();
});
