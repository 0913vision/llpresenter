import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect, it} from 'vitest';

const LAYERS_CSS = readFileSync(
  resolve(import.meta.dirname, 'layers.module.css'),
  'utf8',
);

const RULE = /([^{}]+)\{([^}]*)\}/g;

it('declares the picture transform only on the layer boxes of the root', () => {
  const transforming = [...LAYERS_CSS.matchAll(RULE)]
    .filter(([, , body = '']) => body.includes('transform:'))
    .map(([, selector = '', body = '']) => [
      selector.replace(/\/\*[\s\S]*?\*\//g, '').trim(),
      body.trim(),
    ]);
  expect(transforming).toEqual([
    ['.root > .layer', 'transform: var(--picture-transform, none);'],
  ]);
});
