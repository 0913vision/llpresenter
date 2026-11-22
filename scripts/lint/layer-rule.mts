import type {Rule} from 'eslint';
import {checkedFile, onImports, type Aliases} from './imports.mts';

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
  readonly aliases: Aliases;
  /**
   * Folders checked as if they were other folders, such as `test/core` for
   * `src/core`. The longest matching folder wins.
   */
  readonly mirrors?: Readonly<Record<string, string>>;
}

function mirrored(path: string, mirrors: LayerMap['mirrors']): string {
  const folder = Object.keys(mirrors ?? {})
    .filter(dir => path === dir || path.startsWith(`${dir}/`))
    .reduce<string | undefined>(
      (best, dir) =>
        best === undefined || dir.length > best.length ? dir : best,
      undefined,
    );
  if (folder === undefined) return path;
  return (mirrors?.[folder] ?? folder) + path.slice(folder.length);
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
      const importer = checkedFile(context);
      const own = layerOf(map.layers, mirrored(importer, map.mirrors));
      if (own === undefined) return {};
      return onImports(importer, map.aliases, ({node, path}) => {
        const target = layerOf(map.layers, mirrored(path, map.mirrors));
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
      });
    },
  };
}
