import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

function declarations(path: string, selector: string): string {
  const source = readFileSync(path, 'utf8');
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Missing ${selector}`);
  const end = source.indexOf('}', start);
  if (end < 0) throw new Error(`Unclosed ${selector}`);
  return source.slice(start, end);
}

describe('grid slide text fields', () => {
  it.each([
    [
      'src/renderer/src/features/songs/editor/SongEditor.module.css',
      '.block[data-grid] .lyrics',
    ],
    [
      'src/renderer/src/features/service/slides/SlidesEditor.module.css',
      ".rows[data-view='grid'] .fields textarea",
    ],
  ])(
    'grows without a scrollbar or a maximum height in %s',
    (path, selector) => {
      const rule = declarations(path, selector);
      expect(rule).toMatch(/field-sizing:\s*content\s*;/);
      expect(rule).toMatch(/overflow:\s*hidden\s*;/);
      expect(rule).toMatch(/max-height:\s*none\s*;/);
    },
  );
});
