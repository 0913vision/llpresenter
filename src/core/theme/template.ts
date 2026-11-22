type Piece =
  | {readonly text: string}
  | {readonly token: string}
  | {readonly optional: readonly Piece[]};

const parsed = new Map<string, readonly Piece[]>();

function parse(template: string): readonly Piece[] {
  const root: Piece[] = [];
  let pieces = root;
  let outer: Piece[] | undefined;
  for (const match of template.matchAll(/\{([^{}]*)\}|\[|\]|[^{}[\]]+|./gu)) {
    const [part, token] = match;
    if (token !== undefined) pieces.push({token});
    else if (part === '[' && outer === undefined) {
      outer = pieces;
      pieces = [];
    } else if (part === ']' && outer !== undefined) {
      outer.push({optional: pieces});
      pieces = outer;
      outer = undefined;
    } else pieces.push({text: part});
  }
  if (outer !== undefined) {
    outer.push({text: '['}, ...pieces);
  }
  return root;
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

function fill(pieces: readonly Piece[], values: Values): string | null {
  let text = '';
  for (const piece of pieces) {
    if ('text' in piece) text += piece.text;
    else if ('token' in piece) {
      const value = values(piece.token);
      if (value === undefined || value.trim() === '') return null;
      text += value;
    } else text += fill(piece.optional, values) ?? '';
  }
  return text;
}

/**
 * The first of the templates whose values are all there, filled in. `{이름}`
 * stands for a value, and `[...]` is left out when a value inside it is missing.
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
    else if ('optional' in piece) tokensIn(piece.optional, into);
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
