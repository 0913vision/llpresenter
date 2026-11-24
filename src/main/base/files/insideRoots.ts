import {realpath} from 'node:fs/promises';
import {isAbsolute, relative} from 'node:path';

async function realOrNull(path: string): Promise<string | null> {
  try {
    return await realpath(path);
  } catch {
    return null;
  }
}

function contains(root: string, path: string): boolean {
  const inside = relative(root, path);
  return (
    inside.length > 0 &&
    inside !== '..' &&
    !inside.startsWith(`..\\`) &&
    !inside.startsWith('../') &&
    !isAbsolute(inside)
  );
}

/**
 * Finds the real path of a file, with links and `..` resolved, and checks that
 * it lies inside one of the roots, so a crafted id or a link can't reach a
 * file outside them.
 *
 * @returns The real path, or null when the file is missing or outside every
 * root.
 */
export async function realPathInside(
  path: string,
  roots: readonly string[],
): Promise<string | null> {
  const real = await realOrNull(path);
  if (real === null) return null;
  for (const root of roots) {
    const realRoot = await realOrNull(root);
    if (realRoot !== null && contains(realRoot, real)) return real;
  }
  return null;
}
