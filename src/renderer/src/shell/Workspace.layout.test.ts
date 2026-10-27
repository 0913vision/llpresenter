import {describe, expect, it} from 'vitest';
import {cssRules} from './testing/cssRules';

const ruleOf = cssRules('src/renderer/src/shell/Workspace.module.css');

describe('Workspace layout rules', () => {
  it('uses the shared title scale for workspace wrapper headings', () => {
    expect(ruleOf('.tab')).toContain('font: var(--type-title)');
  });

  it('lets embedded panels shrink their bodies inside the assigned column height', () => {
    const rule = ruleOf('.embedded');
    expect(rule).toContain('display: flex');
    expect(rule).toContain('flex-direction: column');
    expect(rule).toContain('min-height: 0');
  });

  it('keeps room for the scrollbar in a body that sizes its content from its width', () => {
    expect(ruleOf('.stableScrollbar')).toContain('scrollbar-gutter: stable');
  });
});
