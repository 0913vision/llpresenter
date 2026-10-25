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
    const start = css.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`No rule for ${selector}`);
    return css.slice(start, css.indexOf('}', start));
  };
}
