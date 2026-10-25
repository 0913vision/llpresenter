import {describe, expect, it} from 'vitest';
import {cssRules} from './testing/cssRules';

const ruleOf = cssRules('src/renderer/src/shell/Workspace.module.css');

describe('Workspace layout rules', () => {
  it('keeps room for the scrollbar in a body that sizes its content from its width', () => {
    expect(ruleOf('.stableScrollbar')).toContain('scrollbar-gutter: stable');
  });
});
