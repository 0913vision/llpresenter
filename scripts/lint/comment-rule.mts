import type {ESLint, Rule, SourceCode} from 'eslint';

type SourceComment = ReturnType<SourceCode['getAllComments']>[number];
type LocatedComment = SourceComment & {
  readonly loc: NonNullable<SourceComment['loc']>;
};

/** The owner that every NOTE and TODO comment names. */
export const COMMENT_OWNER = '0913vision';

const TAGGED_LINE = new RegExp(`^ (?:NOTE|TODO)\\(${COMMENT_OWNER}\\): \\S`);
const TAG_ATTEMPT = /^\s*(NOTE|TODO)\b/i;
const TRIPLE_SLASH_DIRECTIVE = /^\/\s*<reference\s/;
const TSDOC_MARKER = '*';

function hasLocation(comment: SourceComment): comment is LocatedComment {
  return comment.loc != null;
}

function isTagged(comment: LocatedComment): boolean {
  return comment.type === 'Line' && TAGGED_LINE.test(comment.value);
}

function isTsdoc(comment: LocatedComment): boolean {
  return comment.type === 'Block' && comment.value.startsWith(TSDOC_MARKER);
}

function isTripleSlashDirective(comment: LocatedComment): boolean {
  return comment.type === 'Line' && TRIPLE_SLASH_DIRECTIVE.test(comment.value);
}

function startsOwnLine(
  comment: LocatedComment,
  sourceCode: SourceCode,
): boolean {
  const {line, column} = comment.loc.start;
  const before = sourceCode.lines[line - 1]?.slice(0, column) ?? '';
  return before.trim() === '';
}

function continuesNote(
  previous: LocatedComment | null,
  comment: LocatedComment,
  sourceCode: SourceCode,
): boolean {
  if (previous === null || comment.type !== 'Line') return false;
  return (
    comment.loc.start.line === previous.loc.end.line + 1 &&
    comment.loc.start.column === previous.loc.start.column &&
    startsOwnLine(comment, sourceCode)
  );
}

function reportDisallowed(
  context: Rule.RuleContext,
  comment: LocatedComment,
): void {
  const tag = TAG_ATTEMPT.exec(comment.value)?.[1];
  if (tag === undefined) {
    context.report({loc: comment.loc, messageId: 'disallowed'});
    return;
  }
  context.report({
    loc: comment.loc,
    messageId: 'malformedTag',
    data: {tag: tag.toUpperCase(), owner: COMMENT_OWNER},
  });
}

function checkComments(context: Rule.RuleContext): void {
  const {sourceCode} = context;
  // NOTE(0913vision): ESLint parsers always attach a location to comments;
  // the filter only narrows the type.
  const comments = sourceCode.getAllComments().filter(hasLocation);
  let noteLine: LocatedComment | null = null;
  for (const comment of comments) {
    if (isTagged(comment) || continuesNote(noteLine, comment, sourceCode)) {
      noteLine = comment;
      continue;
    }
    noteLine = null;
    if (isTsdoc(comment) || isTripleSlashDirective(comment)) continue;
    reportDisallowed(context, comment);
  }
}

/**
 * Allows only the comments that `CLAUDE.md` permits: TSDoc block comments,
 * `// NOTE(0913vision): ...`, and `// TODO(0913vision): ...`. Plain `//` lines
 * directly under a NOTE or TODO line, in the same column, continue it.
 * Triple-slash directives are left to `@typescript-eslint/triple-slash-reference`.
 */
export const allowedCommentsRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Allow only TSDoc, NOTE(0913vision), and TODO(0913vision) comments',
    },
    schema: [],
    messages: {
      disallowed:
        'Only TSDoc (/** ... */), // NOTE(0913vision): ..., and // TODO(0913vision): ... comments are allowed. Delete this comment or rewrite it as one of those.',
      malformedTag:
        'Write this as a line comment: // {{tag}}({{owner}}): <text>.',
    },
  },
  create(context) {
    return {
      Program() {
        checkComments(context);
      },
    };
  },
};

/** The local ESLint plugin that holds the project's own rules. */
export const llpPlugin = {
  meta: {name: 'llp'},
  rules: {'allowed-comments': allowedCommentsRule},
} satisfies ESLint.Plugin;
