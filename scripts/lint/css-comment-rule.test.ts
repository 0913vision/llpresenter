import stylelint from 'stylelint';
import {describe, expect, it} from 'vitest';
import {stylelintConfig as config} from './stylelint-config.mts';

async function lintCss(code: string): Promise<readonly string[]> {
  const {results} = await stylelint.lint({code, config, codeFilename: 'a.css'});
  return results.flatMap(result => result.warnings.map(w => w.rule));
}

describe('stylelint config', () => {
  it('allows NOTE and TODO comments, including several lines', async () => {
    const css = [
      '/* NOTE(0913vision): The slot clips its edges,',
      '   so the lines sit inside. */',
      '.a { color: var(--text); }',
      '/* TODO(0913vision): Add a token. */',
    ].join('\n');
    expect(await lintCss(css)).toEqual([]);
  });

  it.each([
    ['a plain comment', '/* spacing */ .a { margin: 0; }'],
    ['a tag without the owner', '/* NOTE: spacing */ .a { margin: 0; }'],
    ['a tag with no text', '/* TODO(0913vision): */ .a { margin: 0; }'],
  ])('rejects %s', async (_name, css) => {
    expect(await lintCss(css)).toEqual(['llp/allowed-comments']);
  });

  it.each([
    ['a hex color', '.a { color: #fff; }', 'color-no-hex'],
    ['a named color', '.a { color: red; }', 'color-named'],
    [
      'an rgba color',
      '.a { color: rgba(0, 0, 0, 0.5); }',
      'function-disallowed-list',
    ],
    [
      'a literal gap',
      '.a { gap: 8px; }',
      'declaration-property-value-disallowed-list',
    ],
    [
      'a literal radius',
      '.a { border-radius: 4px; }',
      'declaration-property-value-disallowed-list',
    ],
  ])('rejects %s', async (_name, css, rule) => {
    expect(await lintCss(css)).toEqual([rule]);
  });

  it('rejects a raw font size', async () => {
    expect(await lintCss('.a { font-size: 160px; }')).toEqual([
      'declaration-property-value-disallowed-list',
    ]);
  });

  it('does not let a disable directive bypass the rules', async () => {
    const css = '/* stylelint-disable */ .a { color: #fff; }';
    expect(await lintCss(css)).toEqual([
      'llp/allowed-comments',
      'color-no-hex',
    ]);
  });

  it('allows tokens, zero, percentages, and unit-less values', async () => {
    const css =
      '.a { margin: 0 var(--space-4); width: 100%; height: calc(100vh - var(--size-menubar)); flex: 1; border: 1px solid var(--line); }';
    expect(await lintCss(css)).toEqual([]);
  });
});
