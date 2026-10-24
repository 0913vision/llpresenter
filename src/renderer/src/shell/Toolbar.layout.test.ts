/// <reference types="node" />
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

const css = readFileSync(
  resolve('src/renderer/src/shell/Toolbar.module.css'),
  'utf8',
);

function ruleOf(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No rule for ${selector}`);
  return css.slice(start, css.indexOf('}', start));
}

describe('Toolbar layout rules', () => {
  it('makes the search field 420 wide, and 280 in the narrow window', () => {
    expect(ruleOf('.bar')).toContain('--toolbar-search-width: 420px');
    expect(ruleOf('.barCompact')).toContain('--toolbar-search-width: 280px');
    expect(ruleOf('.search')).toContain('width: var(--toolbar-search-width)');
  });

  it('lets the search field shrink first, with no minimum width', () => {
    expect(ruleOf('.search')).toContain('max-width: 100%');
    expect(ruleOf('.center')).toContain('min-width: 0');
  });
});
