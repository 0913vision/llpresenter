import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';

it('keeps the mouse pointer visible on output content', () => {
  const css = readFileSync(new URL('./output.css', import.meta.url), 'utf8');
  expect(css).not.toMatch(/cursor\s*:\s*none\b/);
  expect(css).toMatch(/cursor\s*:\s*auto\b/);
});
