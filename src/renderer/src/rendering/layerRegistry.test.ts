import {describe, expect, it} from 'vitest';
import {defineLayer, type RegisteredLayer} from './layer';
import {layerRegistryOf} from './layerRegistry';
import {renderLayers} from './layers';

function layer(kind: string, order: number): RegisteredLayer {
  return defineLayer({
    kind,
    order,
    create: () => ({render: () => {}, dispose: () => {}}),
  });
}

describe('layerRegistryOf', () => {
  it('sorts declared stacking order regardless of file name or module insertion order', () => {
    const registry = layerRegistryOf({
      './first.ts': {layer: layer('front', 3)},
      './last.ts': {helper: 'ignored', layer: layer('back', 0)},
    });
    expect(registry.map(entry => entry.kind)).toEqual(['back', 'front']);
  });

  it('rejects duplicate layer kinds', () => {
    expect(() =>
      layerRegistryOf({
        './module.ts': {a: layer('same', 0), b: layer('same', 1)},
      }),
    ).toThrow('two render layers use same');
  });

  it('rejects ambiguous stacking orders', () => {
    expect(() =>
      layerRegistryOf({
        './module.ts': {a: layer('back', 0), b: layer('front', 0)},
      }),
    ).toThrow('two render layers use order 0');
  });

  it.each([NaN, Infinity, -1, 0.5])(
    'rejects an invalid stacking order %s',
    order => {
      expect(() =>
        layerRegistryOf({'./invalid.ts': {layer: layer('invalid', order)}}),
      ).toThrow('invalid stacking order for invalid');
    },
  );

  it.each([null, {}, {helper: 'not a layer'}])(
    'rejects a module with no layer: %j',
    module => {
      expect(() => layerRegistryOf({'./empty.ts': module})).toThrow(
        './empty.ts exports no render layer',
      );
    },
  );

  it('discovers the existing layers in their original stack and excludes fixture modules', () => {
    const declared = renderLayers.map(({kind, order}) => ({kind, order}));
    expect(declared).toEqual(
      expect.arrayContaining([
        {kind: 'background', order: 0},
        {kind: 'lyrics', order: 1},
      ]),
    );
    expect(declared.some(layer => layer.kind.startsWith('fixture'))).toBe(
      false,
    );
  });
});
