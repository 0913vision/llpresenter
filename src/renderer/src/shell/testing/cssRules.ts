/// <reference types="node" />
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

/**
 * Reads a CSS file and returns a function that finds the body of the rule
 * with the exact selector. The function throws when there is no such rule.
 *
 * @param file - The path from the repository root.
 */
export function cssRules(file: string): (selector: string) => string {
  const css = readFileSync(resolve(file), 'utf8');
  return selector => {
    for (const rule of css.split('}')) {
      const start = rule.indexOf('{');
      if (rule.slice(0, start).trim() === selector) {
        return rule.slice(start + 1);
      }
    }
    throw new Error(`No rule for ${selector}`);
  };
}
