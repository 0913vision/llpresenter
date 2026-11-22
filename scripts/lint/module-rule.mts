import type {Rule} from 'eslint';
import {checkedFile, onImports, type Aliases} from './imports.mts';

/** A folder whose subfolders are modules, such as `src/core`. */
export interface ModuleArea {
  /** The folder, relative to the repository root, with forward slashes. */
  readonly dir: string;
  /** Subfolders that are no modules: each of their files is imported. */
  readonly open: readonly string[];
}

/** The modules that `llp/module-entry` enforces and how imports name them. */
export interface ModuleMap {
  readonly areas: readonly ModuleArea[];
  readonly aliases: Aliases;
}

interface Place {
  /** The folder of the module, from the repository root. */
  readonly folder: string;
  readonly open: boolean;
}

function placeOf(areas: readonly ModuleArea[], path: string): Place | null {
  for (const {dir, open} of areas) {
    if (!path.startsWith(`${dir}/`)) continue;
    const name = path.slice(dir.length + 1).split('/')[0] ?? '';
    return {folder: `${dir}/${name}`, open: open.includes(name)};
  }
  return null;
}

/**
 * Keeps the inside of a module private. A module is imported by its folder,
 * which its `index.ts` answers, and by an alias; inside a module, imports are
 * relative.
 */
export function moduleEntryRule({areas, aliases}: ModuleMap): Rule.RuleModule {
  return {
    meta: {
      type: 'problem',
      docs: {description: 'Import a module only through its entry'},
      schema: [],
      messages: {
        usesInside: 'Import {{module}} through its index.ts, not {{path}}.',
        usesRelative: 'Import {{module}} by its alias, not by a relative path.',
        usesAlias: 'Import a file of the own module by a relative path.',
      },
    },
    create(context) {
      const importer = checkedFile(context);
      const own = placeOf(areas, importer)?.folder;
      return onImports(importer, aliases, ({node, specifier, path}) => {
        const place = placeOf(areas, path);
        if (place === null) return;
        const {folder: module, open} = place;
        const relative = specifier.startsWith('.');
        if (module === own) {
          if (!relative) context.report({node, messageId: 'usesAlias'});
          return;
        }
        if (!open && path !== module) {
          context.report({node, messageId: 'usesInside', data: {module, path}});
        } else if (relative) {
          context.report({node, messageId: 'usesRelative', data: {module}});
        }
      });
    },
  };
}
