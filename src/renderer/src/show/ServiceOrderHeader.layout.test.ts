import {describe, expect, it} from 'vitest';
import {cssRules} from '@renderer/app/shell/testing/cssRules';

const ruleOf = cssRules('src/renderer/src/show/ServiceOrderHeader.module.css');

describe('ServiceOrderHeader layout rules', () => {
  it('uses the shared title scale independently of the general heading', () => {
    expect(ruleOf('.heading')).toContain('font: var(--type-title)');
  });

  it('allows the title to shrink and truncates it to one line with an ellipsis', () => {
    expect(ruleOf('.heading')).toContain('min-width: 0');
    expect(ruleOf('.name')).toContain('min-width: 0');
    expect(ruleOf('.name')).toContain('overflow: hidden');
    expect(ruleOf('.name')).toContain('text-overflow: ellipsis');
    expect(ruleOf('.name')).toContain('white-space: nowrap');
  });
});
