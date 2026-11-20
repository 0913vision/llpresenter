import type {Rule} from 'eslint';

const HANGUL =
  '(?:AC[0-9A-F]{2}|A[D-F][0-9A-F]{2}|[BC][0-9A-F]{3}|D[0-6][0-9A-F]{2}|D7[0-9A][0-9A-F]|31[3-8][0-9A-F])';
const ESCAPE = new RegExp(String.raw`(?<!\\)((?:\\\\)*)\\u(${HANGUL})`, 'giu');

/** Replaces each Hangul `\u` escape that is not itself escaped. */
export function unescapeHangul(raw: string): string {
  return raw.replace(
    ESCAPE,
    (_match, slashes: string, code: string) =>
      `${slashes}${String.fromCodePoint(Number.parseInt(code, 16))}`,
  );
}

/**
 * Korean text is written as itself. A `\u` escape hides the words from
 * reviewers and from search, so the rule rewrites it into the characters.
 */
export const hangulEscapeRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [],
    messages: {
      escaped: 'Write Korean text as itself, not as a backslash-u escape.',
    },
  },
  create(context) {
    const check = (node: Rule.Node, raw: string | undefined): void => {
      if (raw === undefined) return;
      const fixed = unescapeHangul(raw);
      if (fixed === raw) return;
      context.report({
        node,
        messageId: 'escaped',
        fix: fixer => fixer.replaceText(node, fixed),
      });
    };
    return {
      Literal(node) {
        if (typeof node.value === 'string' || 'regex' in node) {
          check(node, node.raw);
        }
      },
      TemplateElement(node) {
        const source = context.sourceCode.getText(node);
        check(node, source);
      },
    };
  },
};
