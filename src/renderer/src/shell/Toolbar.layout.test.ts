import {describe, expect, it} from 'vitest';
import {cssRules} from '@renderer/shell/testing/cssRules';

const ruleOf = cssRules('src/renderer/src/shell/Toolbar.module.css');

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
