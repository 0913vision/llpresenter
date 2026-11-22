import {posix, relative, sep} from 'node:path';
import type {Rule} from 'eslint';
import type {
  ExportAllDeclaration,
  ExportNamedDeclaration,
  ImportDeclaration,
  ImportExpression,
} from 'estree';

/** Import prefixes such as `@core/` and the folders they stand for. */
export type Aliases = Readonly<Record<string, string>>;

export type ModuleReference =
  | ImportDeclaration
  | ExportAllDeclaration
  | ExportNamedDeclaration
  | ImportExpression;

/** One import of a file of the repository, with forward slashes in its paths. */
export interface ImportedFile {
  readonly node: ModuleReference;
  readonly specifier: string;
  /** The imported path from the repository root, without its extension. */
  readonly path: string;
}

/** The file that a rule checks, from the repository root. */
export function checkedFile(context: Rule.RuleContext): string {
  return relative(context.cwd, context.filename).split(sep).join('/');
}

function targetPath(
  specifier: string,
  importer: string,
  aliases: Aliases,
): string | null {
  if (specifier.startsWith('.')) {
    return posix.join(posix.dirname(importer), specifier);
  }
  const alias = Object.keys(aliases).find(prefix =>
    specifier.startsWith(prefix),
  );
  if (alias === undefined) return null;
  return posix.join(aliases[alias] ?? '', specifier.slice(alias.length));
}

function specifierOf({source}: ModuleReference): string | null {
  if (source?.type !== 'Literal') return null;
  return typeof source.value === 'string' ? source.value : null;
}

/** Calls `check` for each import that names a file of the repository. */
export function onImports(
  importer: string,
  aliases: Aliases,
  check: (imported: ImportedFile) => void,
): Rule.RuleListener {
  const visit = (node: ModuleReference): void => {
    const specifier = specifierOf(node);
    if (specifier === null) return;
    const path = targetPath(specifier, importer, aliases);
    if (path !== null) check({node, specifier, path});
  };
  return {
    ImportDeclaration: visit,
    ExportAllDeclaration: visit,
    ExportNamedDeclaration: visit,
    ImportExpression: visit,
  };
}
