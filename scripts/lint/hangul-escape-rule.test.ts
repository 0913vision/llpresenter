import {RuleTester} from 'eslint';
import tseslint from 'typescript-eslint';
import {describe, expect, it} from 'vitest';
import {hangulEscapeRule, unescapeHangul} from './hangul-escape-rule.mts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({languageOptions: {parser: tseslint.parser}});

ruleTester.run('hangul-escape', hangulEscapeRule, {
  valid: [
    {name: 'Korean written as itself', code: "export const a = '대기 화면';"},
    {name: 'a non-Korean escape', code: "export const a = '\\u00a0';"},
    {
      name: 'an escaped backslash before u',
      code: "export const a = '\\\\uB300';",
    },
  ],
  invalid: [
    {
      name: 'a Korean escape in a string',
      code: "export const a = '\\uB300\\uAE30 \\uD654\\uBA74';",
      output: "export const a = '대기 화면';",
      errors: [{messageId: 'escaped'}],
    },
    {
      name: 'a Korean escape in a template',
      code: 'export const a = `(${n}\\uC808)`;',
      output: 'export const a = `(${n}절)`;',
      errors: [{messageId: 'escaped'}],
    },
    {
      name: 'a jamo escape in a regular expression',
      code: 'export const a = /[\\u3131-\\u314E]/u;',
      output: 'export const a = /[ㄱ-ㅎ]/u;',
      errors: [{messageId: 'escaped'}],
    },
  ],
});

describe('unescapeHangul', () => {
  it('keeps a doubled backslash and other escapes', () => {
    const slash = '\\';
    expect(
      unescapeHangul(`${slash}${slash}uB300 ${slash}uB300 ${slash}u00b7`),
    ).toBe(`${slash}${slash}uB300 대 ${slash}u00b7`);
  });
});
