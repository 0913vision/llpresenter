import {describe, expect, it} from 'vitest';
import {cssRules} from '@renderer/ui/testing/cssRules';

const barRuleOf = cssRules('src/renderer/src/app/shell/Toolbar.module.css');
const searchRuleOf = cssRules(
  'src/renderer/src/app/shell/ToolbarSearch.module.css',
);

describe('Toolbar layout rules', () => {
  it('makes the search field 420 wide, and 280 in the narrow window', () => {
    expect(barRuleOf('.bar')).toContain('--toolbar-search-width: 420px');
    expect(barRuleOf('.barCompact')).toContain('--toolbar-search-width: 280px');
    expect(searchRuleOf('.search')).toContain(
      'width: var(--toolbar-search-width)',
    );
  });

  it('lets the search field shrink first, with no minimum width', () => {
    expect(searchRuleOf('.search')).toContain('max-width: 100%');
    expect(searchRuleOf('.center')).toContain('min-width: 0');
  });
});
