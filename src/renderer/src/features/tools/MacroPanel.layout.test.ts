import {expect, it} from 'vitest';
import {cssRules} from '@renderer/ui/testing/cssRules';

const ruleOf = cssRules(
  'src/renderer/src/features/tools/MacroPanel.module.css',
);

it('makes covered macro tiles visible and reachable while dragging the palette', () => {
  expect(ruleOf('.palette[data-dragging]')).toContain('opacity: 0');
  expect(ruleOf('.palette[data-dragging]')).toContain('pointer-events: none');
});
