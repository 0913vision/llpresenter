import {describe, expect, it} from 'vitest';
import {cssRules} from '@renderer/shell/testing/cssRules';

const ruleOf = cssRules('src/renderer/src/ui/PreviewFrame.module.css');

describe('PreviewPanel layout rules', () => {
  it('puts all slot buttons and unselected pictures on the same fixed row', () => {
    expect(ruleOf('.hit')).toContain('grid-row: 2');
    expect(ruleOf('.small')).toContain('grid-row: 2');
    expect(ruleOf('.main')).toContain('grid-row: 1');
    expect(ruleOf('.compact')).not.toMatch(/grid-template|flex-direction/);
  });

  it('caps both the small pictures and matching marker slots at the same width', () => {
    for (const selector of ['.small', '.hit']) {
      expect(ruleOf(selector)).toContain('width: 100%');
      expect(ruleOf(selector)).toContain(
        'max-width: var(--size-preview-small-max)',
      );
    }
    expect(ruleOf('.surface')).toContain('aspect-ratio: var(--aspect-output)');
    expect(ruleOf('.marker')).toContain('aspect-ratio: var(--aspect-output)');
  });

  it('lets the large frame shrink and keep 16:9 in the rest of the height', () => {
    const rule = ruleOf('.main .surface');
    expect(rule).toContain('flex: 0 1 auto');
    expect(rule).toContain('min-height: 0');
    expect(rule).toContain('container-type: size');
    expect(ruleOf('.fit')).toContain(
      'width: min(100cqw, calc(100cqh * 16 / 9))',
    );
  });

  it('keeps content-sized pictures from shrinking without changing fill sizing', () => {
    expect(ruleOf('.content')).toContain('grid-template-rows: auto auto');
    expect(ruleOf('.content')).toContain('height: auto');
    expect(ruleOf('.content .main .surface')).toContain('flex-shrink: 0');
    expect(ruleOf('.main .surface')).not.toContain('flex-shrink: 0');
    expect(ruleOf('.monitor')).toContain(
      'grid-template-rows: minmax(0, 1fr) auto',
    );
  });

  it('lets a click reach the slot button rather than the renderer', () => {
    const surface = ruleOf('.surface');
    expect(surface).toContain('pointer-events: none');
    expect(surface).toContain('isolation: isolate');
    expect(ruleOf('.hit')).toContain('z-index: var(--z-slot)');
    expect(ruleOf('.monitor')).toContain('--z-slot: 1');
  });

  it('marks selection in blue with an upward arrow and keeps keyboard focus visible', () => {
    expect(ruleOf('.selected,\n.selected:hover')).toContain(
      'box-shadow: var(--ring-selected)',
    );
    expect(ruleOf('.marker')).toContain('color: var(--accent)');
    expect(ruleOf('.arrow')).toContain('transform: rotate(-90deg)');
    expect(ruleOf('.hit:focus-visible')).toContain(
      'outline: 2px solid var(--accent)',
    );
  });
});
