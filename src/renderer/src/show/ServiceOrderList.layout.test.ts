import {describe, expect, it} from 'vitest';
import {cssRules} from '@renderer/app/shell/testing/cssRules';

const ruleOf = cssRules('src/renderer/src/show/ServiceOrderList.module.css');

describe('ServiceOrderList layout rules', () => {
  it('pads the list body 4 at the top and 8 at the bottom, as a Panel list body', () => {
    expect(ruleOf('.list')).toContain(
      'padding: var(--space-4) 0 var(--space-8)',
    );
  });
});
