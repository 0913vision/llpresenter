import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect, it} from 'vitest';

// NOTE(0913vision): `PICTURE_TRANSFORM` in `pictureCorrection.ts`; a node
// test can't import it, since its types pull in DOM code.
const PICTURE_TRANSFORM = '--picture-transform';

const LAYERS_CSS = readFileSync(
  resolve(import.meta.dirname, 'layers.module.css'),
  'utf8',
);

function rule(name: string): string {
  return (
    new RegExp(String.raw`\.${name}\s*\{([^}]*)\}`).exec(LAYERS_CSS)?.[1] ?? ''
  );
}

it('moves every layer box by the picture transform and keeps the root, with its empty color, in place', () => {
  expect(rule('layer')).toContain(
    `transform: var(${PICTURE_TRANSFORM}, none);`,
  );
  expect(rule('root')).not.toContain('transform');
  expect(rule('root')).toContain('background:');
});
