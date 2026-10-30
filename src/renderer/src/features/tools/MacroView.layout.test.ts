import {expect, it} from 'vitest';
import {cssRules} from '@renderer/app/shell/testing/cssRules';

const ruleOf = cssRules('src/renderer/src/features/tools/MacroView.module.css');

it('keeps the macro count on one line in a narrow panel', () => {
  expect(ruleOf('.header > span')).toContain('white-space: nowrap');
  expect(ruleOf('.header > span')).toContain('flex: none');
});
