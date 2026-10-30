import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect, it} from 'vitest';

const PATTERN_CSS = readFileSync(
  resolve(import.meta.dirname, 'testPattern.module.css'),
  'utf8',
);

function rule(selector: string): string {
  const escaped = selector.replace(/[.[\]:]/g, '\\$&');
  return (
    new RegExp(String.raw`${escaped}\s*\{([^}]*)\}`).exec(PATTERN_CSS)?.[1] ??
    ''
  );
}

it('hides a hidden pattern even though its class sets a display', () => {
  expect(rule('.pattern')).toContain('display: grid;');
  expect(rule('.pattern[hidden]')).toContain('display: none;');
});

it('draws the 2 px white border over the picture edge', () => {
  expect(rule('.pattern::after')).toContain(
    'box-shadow: inset 0 0 0 2px #ffffff;',
  );
});
