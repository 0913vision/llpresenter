import {posix, relative, sep} from 'node:path';
import type {Rule} from 'eslint';
import type {
  ExportAllDeclaration,
  ExportNamedDeclaration,
  ImportDeclaration,
  ImportExpression,
} from 'estree';

/** One layer of the code: a folder and the layers it may import. */
export interface Layer {
  readonly name: string;
  /** The folder, relative to the repository root, with forward slashes. */
  readonly dir: string;
  readonly imports: readonly string[];
}

/** The layers that `llp/layer-imports` enforces and how imports name them. */
export interface LayerMap {
  readonly layers: readonly Layer[];
  /** Import prefixes such as `@core/` and the folders they stand for. */
  readonly aliases: Readonly<Record<string, string>>;
}

type ModuleReference =
  | ImportDeclaration
  | ExportAllDeclaration
  | ExportNamedDeclaration
  | ImportExpression;

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function layerOf(layers: readonly Layer[], path: string): Layer | undefined {
  return layers
    .filter(layer => path === layer.dir || path.startsWith(`${layer.dir}/`))
    .reduce<Layer | undefined>(
      (best, layer) =>
        best === undefined || layer.dir.length > best.dir.length ? layer : best,
      undefined,
    );
}

function targetPath(
  specifier: string,
  importer: string,
  aliases: LayerMap['aliases'],
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

function sourceOf(node: ModuleReference): string | null {
  const {source} = node;
  if (source?.type !== 'Literal') return null;
  return typeof source.value === 'string' ? source.value : null;
}

/**
 * Keeps imports flowing one way between the layers of `map`: a file may
 * import its own layer and the layers its layer lists, nothing else. Files and
 * targets outside every layer, and package imports, are not checked.
 */
export function layerImportsRule(map: LayerMap): Rule.RuleModule {
  return {
    meta: {
      type: 'problem',
      docs: {description: 'Allow imports only along the declared layers'},
      schema: [],
      messages: {
        crossesLayer:
          '{{from}} may not import {{to}}. {{from}} may import only: {{allowed}}.',
      },
    },
    create(context) {
      const importer = toPosix(relative(context.cwd, context.filename));
      const own = layerOf(map.layers, importer);
      if (own === undefined) return {};
      const check = (node: ModuleReference): void => {
        const specifier = sourceOf(node);
        if (specifier === null) return;
        const path = targetPath(specifier, importer, map.aliases);
        const target = path === null ? undefined : layerOf(map.layers, path);
        if (target === undefined || target === own) return;
        if (own.imports.includes(target.name)) return;
        context.report({
          node,
          messageId: 'crossesLayer',
          data: {
            from: own.name,
            to: target.name,
            allowed: own.imports.join(', ') || 'nothing else',
          },
        });
      };
      return {
        ImportDeclaration: check,
        ExportAllDeclaration: check,
        ExportNamedDeclaration: check,
        ImportExpression: check,
      };
    },
  };
}
