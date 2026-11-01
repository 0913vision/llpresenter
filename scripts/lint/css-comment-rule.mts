import stylelint from 'stylelint';
import {COMMENT_OWNER} from './comment-rule.mts';

/** The name that `stylelint.config.mjs` registers the rule under. */
export const CSS_COMMENT_RULE_NAME = 'llp/allowed-comments';

const TAGGED_COMMENT = new RegExp(
  String.raw`^\s*(?:NOTE|TODO)\(${COMMENT_OWNER}\): \S`,
);

const messages = stylelint.utils.ruleMessages(CSS_COMMENT_RULE_NAME, {
  disallowed: () =>
    `Only /* NOTE(${COMMENT_OWNER}): ... */ and /* TODO(${COMMENT_OWNER}): ... */ comments are allowed. Delete this comment or rewrite it as one of those.`,
});

/** Allows only the CSS comments that `CLAUDE.md` permits: NOTE and TODO. */
export const cssCommentRule: stylelint.Rule = primary => {
  return (root, result) => {
    const valid = stylelint.utils.validateOptions(
      result,
      CSS_COMMENT_RULE_NAME,
      {
        actual: primary,
        possible: [true],
      },
    );
    if (!valid) return;
    root.walkComments(comment => {
      if (TAGGED_COMMENT.test(comment.text)) return;
      stylelint.utils.report({
        result,
        ruleName: CSS_COMMENT_RULE_NAME,
        message: messages.disallowed(),
        node: comment,
      });
    });
  };
};
cssCommentRule.ruleName = CSS_COMMENT_RULE_NAME;
cssCommentRule.messages = messages;

/** The plugin that registers the rule with Stylelint. */
export const cssCommentPlugin = stylelint.createPlugin(
  CSS_COMMENT_RULE_NAME,
  cssCommentRule,
);
