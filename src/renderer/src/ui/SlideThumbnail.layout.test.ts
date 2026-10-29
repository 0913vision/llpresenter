import {describe, expect, it} from 'vitest';
import {cssRules} from '@renderer/shell/testing/cssRules';

const ruleOf = cssRules('src/renderer/src/ui/SlideThumbnail.module.css');

const SHOW_SELECTED_NOT_LIVE =
  ".grid[data-workspace='show'] .thumb[aria-selected='true']:not([data-state~='live'])";

describe('SlideThumbnail ring rules', () => {
  it('hides the selected ring of a 진행 slide that is not live', () => {
    expect(ruleOf(SHOW_SELECTED_NOT_LIVE)).toContain('box-shadow: none');
  });

  it('gives a hovered selected 진행 slide the hover ring of every other slide', () => {
    expect(ruleOf(`${SHOW_SELECTED_NOT_LIVE}:hover`)).toContain(
      'box-shadow: var(--ring-hover)',
    );
    expect(ruleOf('.thumb:hover')).toContain('box-shadow: var(--ring-hover)');
  });
});
