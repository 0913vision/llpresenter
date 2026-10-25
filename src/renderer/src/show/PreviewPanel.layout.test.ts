import {describe, expect, it} from 'vitest';
import {cssRules} from '@renderer/shell/testing/cssRules';

const ruleOf = cssRules('src/renderer/src/show/PreviewPanel.module.css');

describe('PreviewPanel layout rules', () => {
  it('caps the width of a small preview, so a wide column cannot make it tall', () => {
    expect(ruleOf('.panel')).toMatch(/--small-max-width: \d+px/);
    expect(ruleOf('.item:not(.large):not(.compact) .slot')).toContain(
      'width: min(100%, var(--small-max-width))',
    );
  });

  it('leaves the 64px row form of the narrow window alone', () => {
    expect(ruleOf('.compact .slot')).toContain('width: 64px');
  });

  it('lets the large frame shrink and keep 16:9 in the rest of the height', () => {
    const rule = ruleOf('.large .slot');
    expect(rule).toContain('flex: 0 1 auto');
    expect(rule).toContain('aspect-ratio: 16 / 9');
    expect(rule).toContain('container-type: size');
  });

  it('lets a click reach the button over a small preview, not the renderer', () => {
    const slot = ruleOf('.slot');
    expect(slot).toContain('pointer-events: none');
    expect(slot).toContain('isolation: isolate');
    expect(ruleOf('.hit')).toContain('z-index: var(--z-preview-hit)');
    expect(ruleOf('.panel')).toContain('--z-preview-hit: 1');
  });
});
