type Piece =
  | {readonly text: string}
  | {readonly token: string; readonly brackets: boolean};

const parsed = new Map<string, readonly Piece[]>();

function parse(template: string): readonly Piece[] {
  const pieces: Piece[] = [];
  for (const [part, inner] of template.matchAll(/\{([^{}]*)\}|[^{}]+|./gu)) {
    if (inner === undefined) {
      pieces.push({text: part});
      continue;
    }
    const bracketed = /^\((.*)\)$/u.exec(inner)?.[1];
    pieces.push(
      bracketed === undefined
        ? {token: inner, brackets: false}
        : {token: bracketed, brackets: true},
    );
  }
  return pieces;
}

function piecesOf(template: string): readonly Piece[] {
  let pieces = parsed.get(template);
  if (pieces === undefined) {
    pieces = parse(template);
    parsed.set(template, pieces);
  }
  return pieces;
}

type Values = (token: string) => string | undefined;

/**
 * Takes out a value that is missing with one space beside it: the one before
 * it, or the one after it at the start of the text.
 */
function leaveOut(parts: Array<string | null>, at: number): void {
  const before = parts[at - 1];
  const after = parts[at + 1];
  if (typeof before === 'string' && /\s$/u.test(before)) {
    parts[at - 1] = before.trimEnd();
  } else if ((before ?? '') === '' && typeof after === 'string') {
    parts[at + 1] = after.trimStart();
  }
}

function fill(pieces: readonly Piece[], values: Values): string | null {
  const parts = pieces.map(piece => {
    if ('text' in piece) return piece.text;
    const value = values(piece.token)?.trim();
    if (value === undefined || value === '') return null;
    return piece.brackets ? `(${value})` : value;
  });
  const tokens = pieces.filter(piece => 'token' in piece).length;
  const missing = parts.filter(part => part === null).length;
  if (tokens > 0 && missing === tokens) return null;
  parts.forEach((part, at) => {
    if (part === null) leaveOut(parts, at);
  });
  return parts.filter(part => part !== null).join('');
}

/**
 * The first of the templates that has any of its values, filled in. `{이름}`
 * stands for a value and `{(이름)}` for the value in brackets; a missing one
 * is left out with one space beside it. A template without values is taken as
 * it is.
 */
export function fillTemplates(
  templates: readonly string[],
  values: Values,
): string | null {
  for (const template of templates) {
    const text = fill(piecesOf(template), values);
    if (text !== null) return text;
  }
  return null;
}

function tokensIn(pieces: readonly Piece[], into: Set<string>): void {
  for (const piece of pieces) {
    if ('token' in piece) into.add(piece.token);
  }
}

/** The values the templates name. */
export function templateTokens(
  templates: readonly string[],
): ReadonlySet<string> {
  const tokens = new Set<string>();
  for (const template of templates) tokensIn(piecesOf(template), tokens);
  return tokens;
}
